#!/usr/bin/env python3
"""
DataHub V2 API Search Script
datahub_search.py

Cross-workspace search for Power BI and Fabric items using the internal DataHub V2 API.
Returns rich metadata not available via standard APIs (storage mode, last visited, owner, SKU).

AGENT USAGE GUIDE:
------------------
This script searches across ALL workspaces without requiring admin access.
Use it to find items by type, filter by various fields, and get detailed metadata.

IMPORTANT: For semantic models/datasets, use --type Model (not SemanticModel).
           For dataflows, use --type DataFlow (capital F).
           For notebooks, use --type SynapseNotebook.

COMMON PATTERNS:
  # Find all semantic models
  python3 datahub_search.py --type Model

  # Find models by name
  python3 datahub_search.py --type Model --filter "Sales"

  # Find items not accessed in 6+ months
  python3 datahub_search.py --type Model --not-visited-since 2024-06-01

  # Find models refreshed in last month
  python3 datahub_search.py --type Model --refreshed-since 2024-11-01

  # Find stale data (models not refreshed in 30+ days)
  python3 datahub_search.py --type Model --not-refreshed-since 2024-11-01

  # Find recently modified items
  python3 datahub_search.py --type PowerBIReport --updated-since 2024-11-01

  # Find items by owner
  python3 datahub_search.py --type PowerBIReport --owner "kurt"

  # Find Direct Lake models
  python3 datahub_search.py --type Model --storage-mode directlake

  # Find items in specific workspace
  python3 datahub_search.py --type Lakehouse --workspace "fit-data"

  # Get JSON for programmatic use
  python3 datahub_search.py --type Model --output json

  # Sort by last visited (find stale items)
  python3 datahub_search.py --type Model --sort last-visited --sort-order asc

DATE FILTERS:
  --visited-since / --not-visited-since    When user last opened item
  --refreshed-since / --not-refreshed-since When data was last refreshed (models)
  --updated-since / --not-updated-since    When definition was last modified

UNIQUE DATAHUB FIELDS:
  - lastVisitedTimeUTC: When item was last opened/used
  - lastRefreshTime: When model data was last refreshed
  - modifiedDate: When item definition was last changed
  - storageMode: Import (1), DirectQuery (2), or DirectLake
  - ownerUser: Full owner details (name, email)
  - sharedFromEnterpriseCapacitySku: Capacity SKU (F2, F64, PP, etc.)
  - naturalLanguageSupported: Copilot/Q&A readiness
  - cachedModelEnabled: Whether caching is on

These fields are NOT available via fab api or admin APIs.

Usage:
    python3 datahub_search.py --type Model --filter "Sales"
    python3 datahub_search.py --type PowerBIReport --workspace "Production"
    python3 datahub_search.py --type Lakehouse --owner "kurt" --output json
    python3 datahub_search.py --list-types
    python3 datahub_search.py --list-regions
"""

import argparse
import json
import subprocess
import sys
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any


#region Configuration

REGIONS = {
    "west-europe": "wabi-west-europe-e-primary-redirect.analysis.windows.net",
    "north-europe": "wabi-north-europe-e-primary-redirect.analysis.windows.net",
    "us-east": "wabi-us-east-e-primary-redirect.analysis.windows.net",
    "us-east2": "wabi-us-east2-e-primary-redirect.analysis.windows.net",
    "us-west": "wabi-us-west-e-primary-redirect.analysis.windows.net",
    "us-north-central": "wabi-us-north-central-e-primary-redirect.analysis.windows.net",
    "us-south-central": "wabi-us-south-central-e-primary-redirect.analysis.windows.net",
    "south-east-asia": "wabi-south-east-asia-e-primary-redirect.analysis.windows.net",
    "australia-east": "wabi-australia-east-e-primary-redirect.analysis.windows.net",
    "brazil-south": "wabi-brazil-south-e-primary-redirect.analysis.windows.net",
    "canada-central": "wabi-canada-central-e-primary-redirect.analysis.windows.net",
    "india-west": "wabi-india-west-e-primary-redirect.analysis.windows.net",
    "japan-east": "wabi-japan-east-e-primary-redirect.analysis.windows.net",
    "uk-south": "wabi-uk-south-e-primary-redirect.analysis.windows.net",
}

# Item types supported by DataHub API
# IMPORTANT: For semantic models use "Model", for dataflows use "DataFlow"
ITEM_TYPES = {
    # Reports & Dashboards
    "PowerBIReport": {"trident": "report", "category": "Reports", "desc": "Power BI reports (.pbix)"},
    "Report": {"trident": "report", "category": "Reports", "desc": "Alias for PowerBIReport"},
    "PaginatedReport": {"trident": "rdlreport", "category": "Reports", "desc": "Paginated/RDL reports"},
    "Dashboard": {"trident": "dashboard", "category": "Reports", "desc": "Power BI dashboards"},
    "OrgApp": {"trident": "OrgApp", "category": "Reports", "desc": "Published Power BI apps"},
    # Models - USE "Model" FOR SEMANTIC MODELS
    "Model": {"trident": "dataset", "category": "Models", "desc": "Semantic models/datasets (USE THIS)"},
    "SemanticModel": {"trident": "semanticModel", "category": "Models", "desc": "Alternative (often returns 0)"},
    "MetricSet": {"trident": "MetricSet", "category": "Models", "desc": "Metric sets"},
    # Data Storage
    "Lakehouse": {"trident": "Lakehouse", "category": "Data", "desc": "Fabric lakehouses"},
    "Warehouse": {"trident": "Warehouse", "category": "Data", "desc": "Fabric data warehouses"},
    "Datamart": {"trident": "datamart", "category": "Data", "desc": "Power BI datamarts"},
    "Sql": {"trident": "datamart", "category": "Data", "desc": "SQL endpoints"},
    "KustoDatabase": {"trident": "KustoDatabase", "category": "Data", "desc": "KQL databases"},
    "KustoEventHouse": {"trident": "KustoEventHouse", "category": "Data", "desc": "Eventhouse"},
    "SQLDbNative": {"trident": "SQLDbNative", "category": "Data", "desc": "SQL databases"},
    "CosmosDB": {"trident": "CosmosDB", "category": "Data", "desc": "Cosmos DB mirrors"},
    "DatabricksCatalog": {"trident": "DatabricksCatalog", "category": "Data", "desc": "Databricks catalogs"},
    "SqlAnalyticsEndpoint": {"trident": "SqlAnalyticsEndpoint", "category": "Data", "desc": "SQL analytics endpoints"},
    "WarehouseSnapshot": {"trident": "WarehouseSnapshot", "category": "Data", "desc": "Warehouse snapshots"},
    "Lakewarehouse": {"trident": "lake-warehouse", "category": "Data", "desc": "Lake warehouses"},
    "MountedWarehouse": {"trident": "mounted-warehouse", "category": "Data", "desc": "Mounted warehouses"},
    "MountedRelationalDatabase": {"trident": "MountedRelationalDatabase", "category": "Data", "desc": "Mounted databases"},
    # Data Integration - USE "DataFlow" WITH CAPITAL F
    "DataFlow": {"trident": "dataflow", "category": "Integration", "desc": "Power BI dataflows (USE THIS)"},
    "Dataflow": {"trident": "dataflow", "category": "Integration", "desc": "Alias (may not work)"},
    "DataflowFabric": {"trident": "DataflowFabric", "category": "Integration", "desc": "Fabric dataflows Gen2"},
    "Pipeline": {"trident": "Pipeline", "category": "Integration", "desc": "Data pipelines"},
    "DataPipeline": {"trident": "DataPipeline", "category": "Integration", "desc": "Alias for Pipeline"},
    "CopyJob": {"trident": "CopyJob", "category": "Integration", "desc": "Copy jobs"},
    "EventStream": {"trident": "EventStream", "category": "Integration", "desc": "Event streams"},
    "MountedDataFactory": {"trident": "MountedDataFactory", "category": "Integration", "desc": "ADF connections"},
    "ApacheAirflowProject": {"trident": "ApacheAirflowProject", "category": "Integration", "desc": "Airflow projects"},
    # Compute - USE "SynapseNotebook" FOR NOTEBOOKS
    "SynapseNotebook": {"trident": "SynapseNotebook", "category": "Compute", "desc": "Fabric notebooks (USE THIS)"},
    "Notebook": {"trident": "SynapseNotebook", "category": "Compute", "desc": "Alias for SynapseNotebook"},
    "SparkJobDefinition": {"trident": "SparkJobDefinition", "category": "Compute", "desc": "Spark job definitions"},
    # ML & AI
    "MLModel": {"trident": "MLModel", "category": "ML", "desc": "ML models"},
    "MLExperiment": {"trident": "MLExperiment", "category": "ML", "desc": "ML experiments"},
    "OperationalAgents": {"trident": "OperationalAgents", "category": "ML", "desc": "Operational agents"},
    "LLMPlugin": {"trident": "LLMPlugin", "category": "ML", "desc": "LLM/AI plugins"},
    # Real-Time Intelligence
    "KustoDashboard": {"trident": "KustoDashboard", "category": "Real-Time", "desc": "Real-time dashboards"},
    "KustoQueryWorkbench": {"trident": "KustoQueryWorkbench", "category": "Real-Time", "desc": "KQL query workbench"},
    # Solutions & Development
    "Reflex": {"trident": "Reflex", "category": "Solutions", "desc": "Reflex/Activator items"},
    "ReflexProject": {"trident": "ReflexProject", "category": "Solutions", "desc": "Reflex projects"},
    "GraphQL": {"trident": "GraphQL", "category": "Solutions", "desc": "GraphQL APIs"},
    "GraphModel": {"trident": "GraphModel", "category": "Solutions", "desc": "Graph models"},
    "FunctionSet": {"trident": "FunctionSet", "category": "Solutions", "desc": "Function sets"},
    "DataExploration": {"trident": "DataExploration", "category": "Solutions", "desc": "Data exploration"},
    "Exploration": {"trident": "Exploration", "category": "Solutions", "desc": "Explorations"},
    # Ontology & Knowledge
    "Ontology": {"trident": "Ontology", "category": "Knowledge", "desc": "Ontology items (IQ)"},
    # Industry Solutions
    "DigitalTwinBuilder": {"trident": "DigitalTwinBuilder", "category": "Industry", "desc": "Digital twin builder"},
    "HealthDataManager": {"trident": "HealthDataManager", "category": "Industry", "desc": "Healthcare data manager"},
    "HLSCohort": {"trident": "HLSCohort", "category": "Industry", "desc": "Healthcare cohorts"},
    "RetailDataManager": {"trident": "RetailDataManager", "category": "Industry", "desc": "Retail data manager"},
    "SustainabilityDataManager": {"trident": "SustainabilityDataManager", "category": "Industry", "desc": "Sustainability manager"},
    # Configuration
    "Environment": {"trident": "Environment", "category": "Config", "desc": "Spark environments"},
    "Variables": {"trident": "Variables", "category": "Config", "desc": "Variable groups"},
}

DEFAULT_REGION = "west-europe"

#endregion


#region Authentication

def get_fabric_token() -> Optional[str]:
    """
    Get Fabric access token using Azure CLI.

    Returns:
        Access token string or None if failed

    Requires:
        Azure CLI installed and logged in (az login)
    """
    try:
        result = subprocess.run(
            ["az", "account", "get-access-token", "--resource", "https://analysis.windows.net/powerbi/api"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("accessToken")

        print("Error: Azure CLI not authenticated. Run 'az login' first.", file=sys.stderr)
        return None

    except subprocess.TimeoutExpired:
        print("Error: Command timed out", file=sys.stderr)
        return None
    except FileNotFoundError:
        print("Error: Azure CLI not installed. Install with 'brew install azure-cli'", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error getting token: {e}", file=sys.stderr)
        return None

#endregion


#region DataHub API

def search_datahub(
    token: str,
    item_types: List[str],
    region: str = DEFAULT_REGION,
    workspace_id: Optional[str] = None,
    page_size: int = 100,
    page_number: int = 1
) -> Dict[str, Any]:
    """
    Search DataHub V2 API for items across all workspaces.

    Args:
        token: Azure AD access token for Power BI API
        item_types: List of item type names (e.g., ["Model", "PowerBIReport"])
        region: Region key from REGIONS dict (default: west-europe)
        workspace_id: Optional workspace GUID to filter results
        page_size: Results per page, max 1000 (default: 100)
        page_number: Page to retrieve, 1-indexed (default: 1)

    Returns:
        Dict with keys:
            success: bool
            items: List of item dicts (if success)
            count: Number of items returned
            region: Region used
            host: API host used
            error: Error message (if not success)
    """
    host = REGIONS.get(region)
    if not host:
        return {"success": False, "error": f"Unknown region: {region}. Use --list-regions to see options."}

    # Build trident types from our mapping
    trident_types = []
    for item_type in item_types:
        if item_type in ITEM_TYPES:
            trident_types.append(ITEM_TYPES[item_type]["trident"])
        else:
            trident_types.append(item_type.lower())

    # Build API filters
    filters = []
    if workspace_id:
        filters.append({
            "datahubFilterType": "workspace",
            "values": [workspace_id]
        })

    payload = {
        "filters": filters,
        "hostFamily": 4,
        "orderBy": "Default",
        "orderDirection": "",
        "pageNumber": page_number,
        "pageSize": min(page_size, 1000),
        "supportedTypes": item_types,
        "tridentSupportedTypes": trident_types
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    url = f"https://{host}/metadata/datahub/V2/artifacts"

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)

        if response.status_code == 200:
            items = response.json()
            return {
                "success": True,
                "items": items if isinstance(items, list) else [],
                "count": len(items) if isinstance(items, list) else 0,
                "region": region,
                "host": host
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
                "region": region
            }
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out (60s)", "region": region}
    except Exception as e:
        return {"success": False, "error": str(e), "region": region}

#endregion


#region Filtering

def apply_filters(
    items: List[Dict],
    name_filter: Optional[str] = None,
    workspace_filter: Optional[str] = None,
    owner_filter: Optional[str] = None,
    visited_since: Optional[str] = None,
    not_visited_since: Optional[str] = None,
    refreshed_since: Optional[str] = None,
    not_refreshed_since: Optional[str] = None,
    updated_since: Optional[str] = None,
    not_updated_since: Optional[str] = None,
    storage_mode: Optional[str] = None,
    capacity_sku: Optional[str] = None,
) -> List[Dict]:
    """
    Apply multiple filters to items list.

    Args:
        items: List of DataHub item dicts
        name_filter: Filter by item name (case-insensitive contains)
        workspace_filter: Filter by workspace name (case-insensitive contains)
        owner_filter: Filter by owner name/email (case-insensitive contains)
        visited_since: Only items visited on or after this date (YYYY-MM-DD)
        not_visited_since: Only items NOT visited since this date (stale items)
        refreshed_since: Only items refreshed/updated on or after this date (data refresh)
        not_refreshed_since: Only items NOT refreshed since this date (stale data)
        updated_since: Only items modified on or after this date (definition change)
        not_updated_since: Only items NOT modified since this date
        storage_mode: Filter by storage mode (import, directquery, directlake)
        capacity_sku: Filter by capacity SKU (F2, F64, PP, etc.)

    Returns:
        Filtered list of items
    """
    result = items

    # Name filter
    if name_filter:
        name_lower = name_filter.lower()
        result = [
            item for item in result
            if name_lower in item.get("displayName", "").lower()
            or name_lower in item.get("name", "").lower()
        ]

    # Workspace filter
    if workspace_filter:
        ws_lower = workspace_filter.lower()
        result = [
            item for item in result
            if ws_lower in item.get("workspaceName", "").lower()
        ]

    # Owner filter
    if owner_filter:
        owner_lower = owner_filter.lower()
        result = [
            item for item in result
            if owner_lower in item.get("ownerUser", {}).get("emailAddress", "").lower()
            or owner_lower in item.get("ownerUser", {}).get("givenName", "").lower()
            or owner_lower in item.get("ownerUser", {}).get("familyName", "").lower()
        ]

    # Visited since filter
    if visited_since:
        try:
            since_date = datetime.strptime(visited_since, "%Y-%m-%d")
            result = [
                item for item in result
                if item.get("lastVisitedTimeUTC") and
                datetime.strptime(item["lastVisitedTimeUTC"][:10], "%Y-%m-%d") >= since_date
            ]
        except ValueError:
            print(f"Warning: Invalid date format '{visited_since}', use YYYY-MM-DD", file=sys.stderr)

    # Not visited since filter (stale items)
    if not_visited_since:
        try:
            since_date = datetime.strptime(not_visited_since, "%Y-%m-%d")
            result = [
                item for item in result
                if item.get("lastVisitedTimeUTC") and
                datetime.strptime(item["lastVisitedTimeUTC"][:10], "%Y-%m-%d") < since_date
            ]
        except ValueError:
            print(f"Warning: Invalid date format '{not_visited_since}', use YYYY-MM-DD", file=sys.stderr)

    # Refreshed since filter (models: lastRefreshTime, notebooks: lastUpdatedDate)
    if refreshed_since:
        try:
            since_date = datetime.strptime(refreshed_since, "%Y-%m-%d")
            def get_refresh_datetime(item):
                refresh_str = item.get("lastRefreshTime")
                if refresh_str:
                    return _parse_odata_date(refresh_str)
                artifact = item.get("artifact", {})
                refresh_str = artifact.get("LastRefreshTime") or artifact.get("lastRefreshTime")
                if refresh_str:
                    return _parse_odata_date(refresh_str)
                updated = artifact.get("lastUpdatedDate")
                if updated:
                    return _parse_odata_date(updated)
                return None
            result = [
                item for item in result
                if get_refresh_datetime(item) and get_refresh_datetime(item) >= since_date
            ]
        except ValueError:
            print(f"Warning: Invalid date format '{refreshed_since}', use YYYY-MM-DD", file=sys.stderr)

    # Not refreshed since filter (stale data)
    if not_refreshed_since:
        try:
            since_date = datetime.strptime(not_refreshed_since, "%Y-%m-%d")
            def get_refresh_datetime(item):
                refresh_str = item.get("lastRefreshTime")
                if refresh_str:
                    return _parse_odata_date(refresh_str)
                artifact = item.get("artifact", {})
                refresh_str = artifact.get("LastRefreshTime") or artifact.get("lastRefreshTime")
                if refresh_str:
                    return _parse_odata_date(refresh_str)
                updated = artifact.get("lastUpdatedDate")
                if updated:
                    return _parse_odata_date(updated)
                return None
            result = [
                item for item in result
                if get_refresh_datetime(item) and get_refresh_datetime(item) < since_date
            ]
        except ValueError:
            print(f"Warning: Invalid date format '{not_refreshed_since}', use YYYY-MM-DD", file=sys.stderr)

    # Updated since filter (when item definition was modified)
    if updated_since:
        try:
            since_date = datetime.strptime(updated_since, "%Y-%m-%d")
            result = [
                item for item in result
                if _parse_odata_date(item.get("modifiedDate")) and
                _parse_odata_date(item.get("modifiedDate")) >= since_date
            ]
        except ValueError:
            print(f"Warning: Invalid date format '{updated_since}', use YYYY-MM-DD", file=sys.stderr)

    # Not updated since filter
    if not_updated_since:
        try:
            since_date = datetime.strptime(not_updated_since, "%Y-%m-%d")
            result = [
                item for item in result
                if _parse_odata_date(item.get("modifiedDate")) and
                _parse_odata_date(item.get("modifiedDate")) < since_date
            ]
        except ValueError:
            print(f"Warning: Invalid date format '{not_updated_since}', use YYYY-MM-DD", file=sys.stderr)

    # Storage mode filter
    if storage_mode:
        mode_lower = storage_mode.lower()
        def matches_storage(item):
            artifact = item.get("artifact", {})
            sm = artifact.get("storageMode")
            dl = artifact.get("directLakeMode", False)
            if mode_lower == "import" and sm == 1:
                return True
            if mode_lower == "directquery" and sm == 2:
                return True
            if mode_lower == "directlake" and dl:
                return True
            return False
        result = [item for item in result if matches_storage(item)]

    # Capacity SKU filter
    if capacity_sku:
        sku_upper = capacity_sku.upper()
        result = [
            item for item in result
            if sku_upper in item.get("artifact", {}).get("sharedFromEnterpriseCapacitySku", "").upper()
        ]

    return result


def _parse_odata_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse OData date format /Date(1234567890)/ to datetime."""
    if not date_str:
        return None
    # Handle OData format: /Date(1234567890)/
    if date_str.startswith("/Date(") and date_str.endswith(")/"):
        try:
            ms = int(date_str[6:-2])
            return datetime.fromtimestamp(ms / 1000)
        except (ValueError, OSError):
            return None
    # Handle ISO format: 2025-11-01T12:00:00
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d")
    except ValueError:
        return None


def _get_item_refresh_time(item: Dict) -> Optional[str]:
    """Get last refresh time from item for sorting/filtering."""
    refresh_time = item.get("lastRefreshTime")
    if refresh_time:
        return refresh_time
    artifact = item.get("artifact", {})
    refresh_time = artifact.get("LastRefreshTime") or artifact.get("lastRefreshTime")
    if refresh_time:
        return refresh_time
    updated = artifact.get("lastUpdatedDate")
    if updated:
        return updated
    return None


def _get_item_refresh_datetime(item: Dict) -> Optional[datetime]:
    """Get last refresh time as datetime for filtering."""
    refresh_str = _get_item_refresh_time(item)
    return _parse_odata_date(refresh_str)


def sort_items(items: List[Dict], sort_by: str, sort_order: str = "desc") -> List[Dict]:
    """
    Sort items by specified field.

    Args:
        items: List of DataHub item dicts
        sort_by: Field to sort by (name, workspace, last-visited, last-refreshed, last-modified, owner)
        sort_order: "asc" or "desc" (default: desc)

    Returns:
        Sorted list
    """
    reverse = sort_order.lower() != "asc"

    if sort_by == "name":
        return sorted(items, key=lambda x: x.get("displayName", "").lower(), reverse=reverse)
    elif sort_by == "workspace":
        return sorted(items, key=lambda x: x.get("workspaceName", "").lower(), reverse=reverse)
    elif sort_by == "last-visited":
        return sorted(items, key=lambda x: x.get("lastVisitedTimeUTC", ""), reverse=reverse)
    elif sort_by == "last-refreshed":
        return sorted(items, key=lambda x: _get_item_refresh_time(x) or "", reverse=reverse)
    elif sort_by == "last-modified":
        return sorted(items, key=lambda x: x.get("modifiedDate", ""), reverse=reverse)
    elif sort_by == "owner":
        return sorted(items, key=lambda x: x.get("ownerUser", {}).get("emailAddress", "").lower(), reverse=reverse)
    else:
        return items

#endregion


#region Output Formatting

def format_output(items: List[Dict], output_format: str = "table", show_fields: Optional[List[str]] = None) -> str:
    """
    Format items for display.

    Args:
        items: List of DataHub item dicts
        output_format: "table", "json", "brief", or "detailed"
        show_fields: Optional list of fields to show in table format

    Returns:
        Formatted string for output
    """
    if output_format == "json":
        # Clean JSON output - remove internal fields
        cleaned = []
        for item in items:
            cleaned.append({
                "name": item.get("displayName", item.get("name")),
                "workspace": item.get("workspaceName"),
                "workspaceId": item.get("workspaceObjectId"),
                "id": item.get("objectId"),
                "lastVisited": item.get("lastVisitedTimeUTC"),
                "lastRefreshed": _get_refresh_time(item),
                "lastModified": _get_modified_time(item),
                "owner": item.get("ownerUser", {}).get("emailAddress"),
                "ownerName": f"{item.get('ownerUser', {}).get('givenName', '')} {item.get('ownerUser', {}).get('familyName', '')}".strip(),
                "storageMode": _get_storage_mode(item),
                "capacitySku": item.get("artifact", {}).get("sharedFromEnterpriseCapacitySku"),
                "isDiscoverable": item.get("isDiscoverable"),
            })
        return json.dumps(cleaned, indent=2)

    if not items:
        return "No items found."

    if output_format == "brief":
        lines = []
        for item in items:
            name = item.get("displayName", item.get("name", "Unknown"))
            workspace = item.get("workspaceName", "")
            lines.append(f"{workspace}/{name}")
        return "\n".join(lines)

    if output_format == "detailed":
        lines = []
        for item in items:
            lines.append(f"Name:        {item.get('displayName', item.get('name', 'Unknown'))}")
            lines.append(f"Workspace:   {item.get('workspaceName', 'N/A')}")
            lines.append(f"ID:          {item.get('objectId', 'N/A')}")
            lines.append(f"Last Visit:  {item.get('lastVisitedTimeUTC', 'N/A')[:19] if item.get('lastVisitedTimeUTC') else 'N/A'}")
            owner = item.get("ownerUser", {})
            lines.append(f"Owner:       {owner.get('givenName', '')} {owner.get('familyName', '')} <{owner.get('emailAddress', 'N/A')}>")
            lines.append(f"Storage:     {_get_storage_mode(item)}")
            lines.append(f"Capacity:    {item.get('artifact', {}).get('sharedFromEnterpriseCapacitySku', 'N/A')}")
            lines.append(f"Discoverable:{item.get('isDiscoverable', 'N/A')}")
            lines.append("-" * 60)
        return "\n".join(lines)

    # Table format (default)
    lines = []
    lines.append(f"{'Name':<35} {'Workspace':<22} {'Last Visited':<12} {'Owner':<20}")
    lines.append("-" * 92)

    for item in items:
        name = item.get("displayName", item.get("name", "Unknown"))[:34]
        workspace = item.get("workspaceName", "")[:21]
        last_visit = item.get("lastVisitedTimeUTC", "")[:10] if item.get("lastVisitedTimeUTC") else ""
        owner = item.get("ownerUser", {})
        owner_name = f"{owner.get('givenName', '')} {owner.get('familyName', '')}"[:19]
        lines.append(f"{name:<35} {workspace:<22} {last_visit:<12} {owner_name:<20}")

    return "\n".join(lines)


def _get_storage_mode(item: Dict) -> str:
    """Get human-readable storage mode from item."""
    artifact = item.get("artifact", {})
    if artifact.get("directLakeMode"):
        return "DirectLake"
    sm = artifact.get("storageMode")
    if sm == 1:
        return "Import"
    elif sm == 2:
        return "DirectQuery"
    return "Unknown"


def _get_refresh_time(item: Dict) -> Optional[str]:
    """Get last refresh time from item as ISO string (models: lastRefreshTime, notebooks: lastUpdatedDate)."""
    # Try top-level lastRefreshTime first (models)
    refresh_time = item.get("lastRefreshTime")
    if refresh_time:
        dt = _parse_odata_date(refresh_time)
        return dt.isoformat() if dt else None
    # Try artifact.LastRefreshTime
    artifact = item.get("artifact", {})
    refresh_time = artifact.get("LastRefreshTime") or artifact.get("lastRefreshTime")
    if refresh_time:
        dt = _parse_odata_date(refresh_time)
        return dt.isoformat() if dt else None
    # Try artifact.lastUpdatedDate (notebooks)
    updated = artifact.get("lastUpdatedDate")
    if updated:
        dt = _parse_odata_date(updated)
        return dt.isoformat() if dt else None
    return None


def _get_modified_time(item: Dict) -> Optional[str]:
    """Get last modified time from item as ISO string."""
    modified = item.get("modifiedDate")
    if modified:
        dt = _parse_odata_date(modified)
        return dt.isoformat() if dt else None
    return None

#endregion


#region Main

def main():
    parser = argparse.ArgumentParser(
        description="""
DataHub V2 API Search - Find Fabric/Power BI items across all workspaces.

Returns rich metadata not available via standard APIs:
  - lastVisitedTimeUTC: When item was last opened
  - storageMode: Import, DirectQuery, or DirectLake
  - ownerUser: Owner name and email
  - capacitySku: F2, F64, PP, etc.

IMPORTANT TYPE MAPPINGS:
  - For semantic models/datasets: use --type Model
  - For dataflows: use --type DataFlow (capital F)
  - For notebooks: use --type SynapseNotebook
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Find all semantic models
  %(prog)s --type Model

  # Find models by name
  %(prog)s --type Model --filter "Sales"

  # Find stale items (not visited in 6+ months)
  %(prog)s --type Model --not-visited-since 2024-06-01

  # Find models refreshed recently
  %(prog)s --type Model --refreshed-since 2024-11-01

  # Find models NOT refreshed in 30+ days (stale data)
  %(prog)s --type Model --not-refreshed-since 2024-11-01

  # Find items by owner
  %(prog)s --type PowerBIReport --owner "kurt"

  # Find Direct Lake models only
  %(prog)s --type Model --storage-mode directlake

  # Find items in specific workspace
  %(prog)s --type Lakehouse --workspace "fit-data"

  # Get clean JSON output
  %(prog)s --type Model --output json

  # Sort by last visited ascending (oldest first)
  %(prog)s --type Model --sort last-visited --sort-order asc

  # Find items on F64 capacity
  %(prog)s --type Model --capacity-sku F64
        """
    )

    # Required
    parser.add_argument("--type", "-t", dest="item_type",
                        help="Item type to search. Use 'Model' for semantic models, 'DataFlow' for dataflows, "
                             "'SynapseNotebook' for notebooks. Run --list-types for all options.")

    # Filters
    filter_group = parser.add_argument_group("Filters")
    filter_group.add_argument("--filter", "-f", dest="filter_text",
                              help="Filter by item name (case-insensitive contains match)")
    filter_group.add_argument("--workspace", "-w", dest="workspace_filter",
                              help="Filter by workspace name (case-insensitive contains match)")
    filter_group.add_argument("--workspace-id",
                              help="Filter by exact workspace GUID")
    filter_group.add_argument("--owner",
                              help="Filter by owner name or email (case-insensitive)")
    filter_group.add_argument("--visited-since",
                              help="Only items visited on or after this date (YYYY-MM-DD)")
    filter_group.add_argument("--not-visited-since",
                              help="Only items NOT visited since this date - find stale items (YYYY-MM-DD)")
    filter_group.add_argument("--refreshed-since",
                              help="Only items refreshed/updated on or after this date (YYYY-MM-DD). "
                                   "Uses lastRefreshTime for models, lastUpdatedDate for notebooks.")
    filter_group.add_argument("--not-refreshed-since",
                              help="Only items NOT refreshed since this date - find stale data (YYYY-MM-DD)")
    filter_group.add_argument("--updated-since",
                              help="Only items modified on or after this date (YYYY-MM-DD). "
                                   "Uses modifiedDate - when definition was changed.")
    filter_group.add_argument("--not-updated-since",
                              help="Only items NOT modified since this date - find unchanged items (YYYY-MM-DD)")
    filter_group.add_argument("--storage-mode",
                              choices=["import", "directquery", "directlake"],
                              help="Filter by storage mode (models only)")
    filter_group.add_argument("--capacity-sku",
                              help="Filter by capacity SKU (e.g., F2, F64, PP)")

    # Sorting
    sort_group = parser.add_argument_group("Sorting")
    sort_group.add_argument("--sort",
                            choices=["name", "workspace", "last-visited", "last-refreshed", "last-modified", "owner"],
                            help="Sort results by field")
    sort_group.add_argument("--sort-order",
                            choices=["asc", "desc"], default="desc",
                            help="Sort order (default: desc)")

    # Output
    output_group = parser.add_argument_group("Output")
    output_group.add_argument("--output", "-o",
                              choices=["table", "json", "brief", "detailed"],
                              default="table",
                              help="Output format: table (default), json (clean), brief (paths only), detailed (all fields)")
    output_group.add_argument("--limit", type=int,
                              help="Limit number of results displayed")

    # API options
    api_group = parser.add_argument_group("API Options")
    api_group.add_argument("--region", "-r", default=DEFAULT_REGION,
                           help=f"Fabric region (default: {DEFAULT_REGION}). Use --list-regions for options.")
    api_group.add_argument("--page-size", type=int, default=200,
                           help="Results per API call, max 1000 (default: 200)")

    # Info
    info_group = parser.add_argument_group("Information")
    info_group.add_argument("--list-types", action="store_true",
                            help="List all available item types with descriptions")
    info_group.add_argument("--list-regions", action="store_true",
                            help="List all available regions")

    args = parser.parse_args()

    # List types
    if args.list_types:
        print("Available item types:\n")
        print("IMPORTANT: Use 'Model' for semantic models, 'DataFlow' for dataflows, 'SynapseNotebook' for notebooks\n")
        by_category = {}
        for name, info in ITEM_TYPES.items():
            cat = info["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append((name, info.get("desc", "")))

        for cat, types in sorted(by_category.items()):
            print(f"  {cat}:")
            for name, desc in sorted(types):
                print(f"    {name:<30} {desc}")
            print()
        return 0

    # List regions
    if args.list_regions:
        print("Available regions:\n")
        for region, host in sorted(REGIONS.items()):
            default = " (default)" if region == DEFAULT_REGION else ""
            print(f"  {region:<20} {host}{default}")
        return 0

    # Require item type for search
    if not args.item_type:
        parser.error("--type is required for search (or use --list-types)")

    # Validate item type
    if args.item_type not in ITEM_TYPES:
        print(f"Warning: '{args.item_type}' not in known types. Trying anyway...", file=sys.stderr)
        print(f"Hint: Use --list-types to see available types", file=sys.stderr)

    # Get token
    print("Getting access token...", file=sys.stderr)
    token = get_fabric_token()
    if not token:
        return 1

    # Search
    print(f"Searching for {args.item_type} in {args.region}...", file=sys.stderr)
    result = search_datahub(
        token=token,
        item_types=[args.item_type],
        region=args.region,
        workspace_id=args.workspace_id,
        page_size=args.page_size
    )

    if not result["success"]:
        print(f"Error: {result['error']}", file=sys.stderr)
        return 1

    items = result["items"]
    print(f"API returned {len(items)} items", file=sys.stderr)

    # Apply filters
    items = apply_filters(
        items,
        name_filter=args.filter_text,
        workspace_filter=args.workspace_filter,
        owner_filter=args.owner,
        visited_since=args.visited_since,
        not_visited_since=args.not_visited_since,
        refreshed_since=args.refreshed_since,
        not_refreshed_since=args.not_refreshed_since,
        updated_since=args.updated_since,
        not_updated_since=args.not_updated_since,
        storage_mode=args.storage_mode,
        capacity_sku=args.capacity_sku,
    )

    # Sort
    if args.sort:
        items = sort_items(items, args.sort, args.sort_order)

    # Limit
    if args.limit:
        items = items[:args.limit]

    # Output
    print(f"\nFound {len(items)} items after filtering:\n", file=sys.stderr)
    print(format_output(items, args.output))

    return 0

#endregion


if __name__ == "__main__":
    sys.exit(main())
