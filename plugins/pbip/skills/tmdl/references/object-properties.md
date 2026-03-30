# TMDL Object Properties Reference

Complete property reference for all TMDL object types. Types in the Type column reference enum values listed at the bottom.

## alternateOf

| Property | Type |
|----------|------|
| `annotation` | array |
| `baseColumn` | string |
| `baseTable` | string |
| `summarization` | summarizationType |

## analyticsAIMetadata

| Property | Type |
|----------|------|
| `measureAnalysisDefinition` | jsonExpression |
| `name` | objectName |

## annotation

| Property | Type |
|----------|------|
| `name` | objectName |
| `value` | string |

## bindingInfo

| Property | Type |
|----------|------|
| `annotation` | array |
| `connectionId` | string |
| `description` | description |
| `extendedProperty` | array |
| `name` | objectName |
| `type` | bindingInfoType |

## calculationExpression

| Property | Type |
|----------|------|
| `description` | description |
| `expression` | defaultDaxExpression |
| `formatStringDefinition` | formatStringDefinition |

## calculationGroup

| Property | Type |
|----------|------|
| `annotation` | array |
| `calculationItem` | array |
| `description` | description |
| `multipleOrEmptySelectionExpression` | calculationExpression |
| `noSelectionExpression` | calculationExpression |
| `precedence` | integer |

## calculationItem

| Property | Type |
|----------|------|
| `description` | description |
| `expression` | defaultDaxExpression |
| `formatStringDefinition` | formatStringDefinition |
| `name` | objectName |
| `ordinal` | integer |

## calendar

| Property | Type |
|----------|------|
| `calendarColumnGroup` | array |
| `description` | description |
| `lineageTag` | string |
| `name` | objectName |
| `sourceLineageTag` | string |

## calendarColumnGroup

| Property | Type |
|----------|------|
| `associatedColumn` | array |
| `column` | array |
| `primaryColumn` | string |
| `timeUnit` | timeUnit |

## changedProperty

| Property | Type |
|----------|------|
| `property` | string |

## column

| Property | Type |
|----------|------|
| `alignment` | alignment |
| `alternateOf` | alternateOf |
| `annotation` | array |
| `changedProperty` | array |
| `columnOrigin` | string |
| `dataCategory` | string |
| `dataType` | dataType |
| `description` | description |
| `displayFolder` | string |
| `displayOrdinal` | integer |
| `encodingHint` | encodingHintType |
| `evaluationBehavior` | evaluationBehavior |
| `expression` | defaultDaxExpression |
| `extendedProperty` | array |
| `formatString` | string |
| `isAvailableInMdx` | boolean |
| `isDataTypeInferred` | boolean |
| `isDefaultImage` | boolean |
| `isDefaultLabel` | boolean |
| `isHidden` | boolean |
| `isKey` | boolean |
| `isNameInferred` | boolean |
| `isNullable` | boolean |
| `isUnique` | boolean |
| `keepUniqueRows` | boolean |
| `lineageTag` | string |
| `name` | objectName |
| `relatedColumnDetails` | relatedColumnDetails |
| `sortByColumn` | string |
| `sourceColumn` | string |
| `sourceLineageTag` | string |
| `sourceProviderType` | string |
| `stringIndex` | indexBuildingMode |
| `summarizeBy` | aggregateFunction |
| `tableDetailPosition` | integer |
| `type` | columnType |
| `variation` | array |

## columnPermission

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `metadataPermission` | metadataPermission |
| `name` | objectName |

## cultureInfo

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `linguisticMetadata` | linguisticMetadata |
| `name` | objectName |
| `translations` | object |

## dataCoverageDefinition

| Property | Type |
|----------|------|
| `annotation` | array |
| `description` | description |
| `expression` | defaultDaxExpression |

## dataSource

| Property | Type |
|----------|------|
| `account` | string |
| `annotation` | array |
| `connectionDetails` | object |
| `connectionString` | string |
| `contextExpression` | string |
| `credential` | object |
| `description` | description |
| `extendedProperty` | array |
| `impersonationMode` | impersonationMode |
| `isolation` | datasourceIsolation |
| `maxConnections` | integer |
| `name` | objectName |
| `options` | object |
| `password` | string |
| `provider` | string |
| `timeout` | integer |
| `type` | dataSourceType |

## database

| Property | Type |
|----------|------|
| `compatibilityLevel` | integer |
| `compatibilityMode` | compatibilityMode |
| `description` | description |
| `id` | string |
| `language` | integer |
| `model` | model |
| `name` | objectName |
| `readWriteMode` | readWriteMode |
| `storageLocation` | string |
| `unicodeCharacterBehavior` | unicodeCharacterBehavior |

## detailRowsDefinition

| Property | Type |
|----------|------|
| `expression` | defaultDaxExpression |

## excludedArtifact

| Property | Type |
|----------|------|
| `artifactType` | integer |
| `reference` | string |

## expression

| Property | Type |
|----------|------|
| `annotation` | array |
| `description` | description |
| `excludedArtifact` | array |
| `expression` | defaultMExpression |
| `expressionSource` | string |
| `extendedProperty` | array |
| `kind` | expressionKind |
| `lineageTag` | string |
| `mAttributes` | string |
| `name` | objectName |
| `parameterValuesColumn` | string |
| `queryGroup` | string |
| `remoteParameterName` | string |
| `sourceLineageTag` | string |

## extendedProperty

| Property | Type |
|----------|------|
| `name` | objectName |
| `type` | extendedPropertyType |
| `value` | string |

## formatStringDefinition

| Property | Type |
|----------|------|
| `expression` | defaultDaxExpression |

## function

| Property | Type |
|----------|------|
| `annotation` | array |
| `changedProperty` | array |
| `description` | description |
| `expression` | defaultDaxExpression |
| `extendedProperty` | array |
| `isHidden` | boolean |
| `lineageTag` | string |
| `name` | objectName |
| `sourceLineageTag` | string |

## hierarchy

| Property | Type |
|----------|------|
| `annotation` | array |
| `changedProperty` | array |
| `description` | description |
| `displayFolder` | string |
| `excludedArtifact` | array |
| `extendedProperty` | array |
| `hideMembers` | hierarchyHideMembersType |
| `isHidden` | boolean |
| `level` | array |
| `lineageTag` | string |
| `name` | objectName |
| `sourceLineageTag` | string |

## kpi

| Property | Type |
|----------|------|
| `annotation` | array |
| `description` | description |
| `extendedProperty` | array |
| `statusDescription` | string |
| `statusExpression` | daxExpression |
| `statusGraphic` | string |
| `targetDescription` | string |
| `targetExpression` | daxExpression |
| `targetFormatString` | string |
| `trendDescription` | string |
| `trendExpression` | daxExpression |
| `trendGraphic` | string |

## level

| Property | Type |
|----------|------|
| `annotation` | array |
| `changedProperty` | array |
| `column` | string |
| `description` | description |
| `extendedProperty` | array |
| `lineageTag` | string |
| `name` | objectName |
| `ordinal` | integer |
| `sourceLineageTag` | string |

## linguisticMetadata

| Property | Type |
|----------|------|
| `annotation` | array |
| `content` | string |
| `contentType` | contentType |
| `extendedProperty` | array |

## measure

| Property | Type |
|----------|------|
| `annotation` | array |
| `changedProperty` | array |
| `dataCategory` | string |
| `dataType` | dataType |
| `description` | description |
| `detailRowsDefinition` | detailRowsDefinition |
| `displayFolder` | string |
| `expression` | defaultDaxExpression |
| `extendedProperty` | array |
| `formatString` | string |
| `formatStringDefinition` | formatStringDefinition |
| `isHidden` | boolean |
| `isSimpleMeasure` | boolean |
| `kpi` | kpi |
| `lineageTag` | string |
| `name` | objectName |
| `sourceLineageTag` | string |

## member

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `identityProvider` | string |
| `memberName` | objectName |
| `memberType` | tmdlRoleMemberType |

## model

| Property | Type |
|----------|------|
| `analyticsAIMetadata` | array |
| `annotation` | array |
| `automaticAggregationOptions` | object |
| `bindingInfo` | array |
| `collation` | string |
| `culture` | string |
| `cultureInfo` | array |
| `dataAccessOptions` | object |
| `dataSource` | array |
| `dataSourceDefaultMaxConnections` | integer |
| `dataSourceVariablesOverrideBehavior` | dataSourceVariablesOverrideBehaviorType |
| `defaultDataView` | dataViewType |
| `defaultMeasure` | string |
| `defaultMode` | modeType |
| `defaultPowerBIDataSourceVersion` | powerBIDataSourceVersion |
| `description` | description |
| `directLakeBehavior` | directLakeBehavior |
| `disableAutoExists` | integer |
| `discourageCompositeModels` | boolean |
| `discourageImplicitMeasures` | boolean |
| `excludedArtifact` | array |
| `expression` | array |
| `extendedProperty` | array |
| `forceUniqueNames` | boolean |
| `function` | array |
| `mAttributes` | string |
| `maxParallelismPerQuery` | integer |
| `maxParallelismPerRefresh` | integer |
| `metadataAccessPolicy` | metadataCategory |
| `name` | objectName |
| `perspective` | array |
| `queryGroup` | array |
| `relationship` | array |
| `role` | array |
| `selectionExpressionBehavior` | selectionExpressionBehaviorType |
| `sourceQueryCulture` | string |
| `storageLocation` | string |
| `table` | array |
| `valueFilterBehavior` | valueFilterBehaviorType |

## partition

| Property | Type |
|----------|------|
| `annotation` | array |
| `dataCoverageDefinition` | dataCoverageDefinition |
| `dataView` | dataViewType |
| `description` | description |
| `extendedProperty` | array |
| `mode` | modeType |
| `name` | objectName |
| `queryGroup` | string |
| `source` | object |
| `sourceType` | partitionSourceType |

## perspective

| Property | Type |
|----------|------|
| `annotation` | array |
| `description` | description |
| `extendedProperty` | array |
| `name` | objectName |
| `perspectiveTable` | array |

## perspectiveColumn

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `name` | objectName |

## perspectiveHierarchy

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `name` | objectName |

## perspectiveMeasure

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `name` | objectName |

## perspectiveTable

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `includeAll` | boolean |
| `name` | objectName |
| `perspectiveColumn` | array |
| `perspectiveHierarchy` | array |
| `perspectiveMeasure` | array |

## queryGroup

| Property | Type |
|----------|------|
| `annotation` | array |
| `description` | description |
| `folder` | objectName |

## refreshPolicy

| Property | Type |
|----------|------|
| `annotation` | array |
| `extendedProperty` | array |
| `incrementalGranularity` | refreshGranularityType |
| `incrementalPeriods` | integer |
| `incrementalPeriodsOffset` | integer |
| `mode` | refreshPolicyMode |
| `policyType` | refreshPolicyType |
| `pollingExpression` | mExpression |
| `rollingWindowGranularity` | refreshGranularityType |
| `rollingWindowPeriods` | integer |
| `sourceExpression` | mExpression |

## relatedColumnDetails

| Property | Type |
|----------|------|
| `groupByColumn` | array |

## relationship

| Property | Type |
|----------|------|
| `annotation` | array |
| `changedProperty` | array |
| `crossFilteringBehavior` | crossFilteringBehavior |
| `extendedProperty` | array |
| `fromCardinality` | relationshipEndCardinality |
| `fromColumn` | string |
| `isActive` | boolean |
| `joinOnDateBehavior` | dateTimeRelationshipBehavior |
| `name` | objectName |
| `relyOnReferentialIntegrity` | boolean |
| `securityFilteringBehavior` | securityFilteringBehavior |
| `toCardinality` | relationshipEndCardinality |
| `toColumn` | string |
| `type` | relationshipType |

## role

| Property | Type |
|----------|------|
| `annotation` | array |
| `description` | description |
| `extendedProperty` | array |
| `member` | array |
| `modelPermission` | modelPermission |
| `name` | objectName |
| `tablePermission` | array |

## table

| Property | Type |
|----------|------|
| `alternateSourcePrecedence` | integer |
| `annotation` | array |
| `calculationGroup` | calculationGroup |
| `calendar` | array |
| `changedProperty` | array |
| `column` | array |
| `dataCategory` | string |
| `defaultDetailRowsDefinition` | detailRowsDefinition |
| `description` | description |
| `excludedArtifact` | array |
| `excludeFromAutomaticAggregations` | boolean |
| `excludeFromModelRefresh` | boolean |
| `extendedProperty` | array |
| `hierarchy` | array |
| `isHidden` | boolean |
| `isPrivate` | boolean |
| `lineageTag` | string |
| `measure` | array |
| `name` | objectName |
| `partition` | array |
| `refreshPolicy` | refreshPolicy |
| `showAsVariationsOnly` | boolean |
| `sourceLineageTag` | string |
| `systemManaged` | boolean |

## tablePermission

| Property | Type |
|----------|------|
| `annotation` | array |
| `columnPermission` | array |
| `extendedProperty` | array |
| `filterExpression` | defaultDaxExpression |
| `metadataPermission` | metadataPermission |
| `name` | objectName |

## variation

| Property | Type |
|----------|------|
| `annotation` | array |
| `defaultColumn` | string |
| `defaultHierarchy` | string |
| `description` | description |
| `extendedProperty` | array |
| `isDefault` | boolean |
| `name` | objectName |
| `relationship` | string |

## Enum Values

**aggregateFunction**: default, none, sum, min, max, count, average, distinctCount

**alignment**: default, left, right, center

**bindingInfoType**: unknown, dataBindingHint

**columnType**: data, calculated, rowNumber, calculatedTableColumn

**compatibilityMode**: unknown, analysisServices, powerBI, excel

**contentType**: xml, json

**crossFilteringBehavior**: oneDirection, bothDirections, automatic

**dataSourceType**: provider, structured

**dataSourceVariablesOverrideBehaviorType**: disallow, allow

**dataType**: automatic, string, int64, double, dateTime, decimal, boolean, binary, unknown, variant

**dataViewType**: full, sample, default

**datasourceIsolation**: readCommitted, snapshot

**dateTimeRelationshipBehavior**: dateAndTime, datePartOnly

**directLakeBehavior**: automatic, directLakeOnly, directQueryOnly

**encodingHintType**: default, hash, value

**evaluationBehavior**: automatic, static, dynamic

**expressionKind**: m

**extendedPropertyType**: string, json

**hierarchyHideMembersType**: default, hideBlankMembers

**impersonationMode**: default, impersonateAccount, impersonateAnonymous, impersonateCurrentUser, impersonateServiceAccount, impersonateUnattendedAccount

**indexBuildingMode**: off, auto, explicit, full

**metadataCategory**: inherited, basic, calculationDefinitions

**metadataPermission**: default, none, read

**modeType**: import, directQuery, default, push, dual, directLake

**modelPermission**: none, read, readRefresh, refresh, administrator

**partitionSourceType**: query, calculated, none, m, entity, policyRange, calculationGroup, inferred

**powerBIDataSourceVersion**: powerBI_V1, powerBI_V2, powerBI_V3

**readWriteMode**: readWrite, readOnly, readOnlyExclusive

**refreshGranularityType**: day, month, quarter, year, invalid

**refreshPolicyMode**: import, hybrid

**refreshPolicyType**: basic

**relationshipEndCardinality**: none, one, many

**relationshipType**: singleColumn

**securityFilteringBehavior**: oneDirection, bothDirections, none

**selectionExpressionBehaviorType**: automatic, visual, nonVisual

**summarizationType**: groupBy, sum, count, min, max

**timeUnit**: unknown, year, semester, semesterOfYear, quarter, quarterOfYear, quarterOfSemester, month, monthOfYear, monthOfSemester, monthOfQuarter, week, weekOfYear, weekOfSemester, weekOfQuarter, weekOfMonth, date, dayOfYear, dayOfSemester, dayOfQuarter, dayOfMonth, dayOfWeek

**tmdlRoleMemberType**: auto, user, group, activeDirectory

**unicodeCharacterBehavior**: codeUnits, codePoints

**valueFilterBehaviorType**: automatic, independent, coalesced

