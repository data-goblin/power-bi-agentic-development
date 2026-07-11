use cliclack::{Theme, ThemeState};
use console::{style, Style};

pub fn install() {
    cliclack::set_theme(PowerBiTheme);
}

struct PowerBiTheme;

impl Theme for PowerBiTheme {
    fn bar_color(&self, state: &ThemeState) -> Style {
        match state {
            ThemeState::Cancel => Style::new().red(),
            ThemeState::Error(_) => Style::new().yellow(),
            ThemeState::Active | ThemeState::Submit => Style::new().yellow(),
        }
    }

    fn state_symbol_color(&self, state: &ThemeState) -> Style {
        match state {
            ThemeState::Cancel => Style::new().red(),
            ThemeState::Error(_) => Style::new().yellow(),
            ThemeState::Active | ThemeState::Submit => Style::new().yellow(),
        }
    }

    fn radio_symbol(&self, state: &ThemeState, selected: bool) -> String {
        match state {
            ThemeState::Active if selected => style("●").yellow().to_string(),
            ThemeState::Active => style("○").dim().to_string(),
            _ => String::new(),
        }
    }

    fn checkbox_symbol(&self, state: &ThemeState, selected: bool, active: bool) -> String {
        match state {
            ThemeState::Active | ThemeState::Error(_) if selected => {
                style("●").yellow().bold().to_string()
            }
            ThemeState::Active | ThemeState::Error(_) if active => style("○").yellow().to_string(),
            ThemeState::Active | ThemeState::Error(_) => style("○").dim().to_string(),
            _ => String::new(),
        }
    }

    fn active_symbol(&self) -> String {
        style("◆").yellow().to_string()
    }

    fn submit_symbol(&self) -> String {
        style("◇").yellow().to_string()
    }

    fn info_symbol(&self) -> String {
        style("●").yellow().to_string()
    }

    fn warning_symbol(&self) -> String {
        style("!").red().bold().to_string()
    }
}
