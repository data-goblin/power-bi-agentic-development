mod agents;
mod cli;
mod config;
mod detect;
mod install;
mod inventory;
mod memory;
mod recommend;
mod registry;
mod source;
mod statusline;
mod theme;
mod util;

use anyhow::Result;
use clap::Parser;
#[cfg(feature = "plugins")]
use cli::PluginsCommand;
use cli::{Cli, Commands, SkillsCommand};

fn main() -> Result<()> {
    theme::install();

    let Cli { global, command } = Cli::parse();

    match command {
        Commands::Skills { command } => match command {
            SkillsCommand::List(args) => cli::skills_list(&global, args),
            SkillsCommand::Recommend(args) => cli::skills_recommend(&global, args),
            SkillsCommand::Setup(args) => cli::skills_setup(&global, args),
            SkillsCommand::Manage(args) => cli::skills_manage(&global, args),
            SkillsCommand::Add(args) => cli::skills_add(&global, args),
            SkillsCommand::Open(args) => cli::skills_open(&global, args),
            SkillsCommand::Doctor(args) => cli::skills_doctor(&global, args),
        },
        #[cfg(feature = "plugins")]
        Commands::Plugins { command } => match command {
            PluginsCommand::List(args) => cli::plugins_list(&global, args),
            PluginsCommand::Setup(args) => cli::plugins_setup(&global, args),
            PluginsCommand::Add(args) => cli::plugins_add(&global, args),
        },
        Commands::Agents(args) => cli::agents(args),
        Commands::Doctor(args) => cli::skills_doctor(&global, args),
        Commands::Memory(args) => cli::memory(&global, args),
        Commands::Statusline { command } => match command {
            cli::StatusLineCommand::Setup(args) => cli::statusline_setup(&global, args),
        },
    }
}
