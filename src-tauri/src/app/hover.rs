use serde::Serialize;

pub const EXPAND_DELAY_MS: u64 = 140;
pub const COLLAPSE_DELAY_MS: u64 = 320;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NotchPhase {
    Collapsed,
    Hover,
    Expanded,
    Hidden,
}

impl Default for NotchPhase {
    fn default() -> Self {
        Self::Collapsed
    }
}

pub struct HoverTracker {
    phase: NotchPhase,
    inside: bool,
    since_ms: u64,
}

impl HoverTracker {
    pub fn new() -> Self {
        Self {
            phase: NotchPhase::Collapsed,
            inside: false,
            since_ms: 0,
        }
    }

    pub fn phase(&self) -> NotchPhase {
        self.phase
    }

    pub fn reset(&mut self) {
        self.phase = NotchPhase::Collapsed;
        self.inside = false;
        self.since_ms = 0;
    }

    pub fn step(&mut self, inside: bool, now_ms: u64) -> NotchPhase {
        if self.phase == NotchPhase::Hidden {
            return self.phase;
        }

        if inside != self.inside {
            self.inside = inside;
            self.since_ms = now_ms;
        }

        let elapsed = now_ms.saturating_sub(self.since_ms);
        self.phase = match self.phase {
            NotchPhase::Collapsed => {
                if inside {
                    NotchPhase::Hover
                } else {
                    NotchPhase::Collapsed
                }
            }
            NotchPhase::Hover => {
                if !inside {
                    NotchPhase::Collapsed
                } else if elapsed >= EXPAND_DELAY_MS {
                    NotchPhase::Expanded
                } else {
                    NotchPhase::Hover
                }
            }
            NotchPhase::Expanded => {
                if inside || elapsed < COLLAPSE_DELAY_MS {
                    NotchPhase::Expanded
                } else {
                    NotchPhase::Collapsed
                }
            }
            NotchPhase::Hidden => NotchPhase::Hidden,
        };

        self.phase
    }
}

#[cfg(test)]
mod tests {
    use super::{HoverTracker, NotchPhase};

    #[test]
    fn waits_before_expanding_and_holds_after_leaving() {
        let mut tracker = HoverTracker::new();

        assert_eq!(tracker.step(true, 0), NotchPhase::Hover);
        assert_eq!(tracker.step(true, 100), NotchPhase::Hover);
        assert_eq!(tracker.step(true, 140), NotchPhase::Expanded);
        assert_eq!(tracker.step(false, 200), NotchPhase::Expanded);
        assert_eq!(tracker.step(false, 520), NotchPhase::Collapsed);
    }

    #[test]
    fn leaving_before_the_delay_cancels_expansion() {
        let mut tracker = HoverTracker::new();

        assert_eq!(tracker.step(true, 0), NotchPhase::Hover);
        assert_eq!(tracker.step(false, 100), NotchPhase::Collapsed);
    }

    #[test]
    fn a_brief_exit_does_not_collapse_an_open_notch() {
        let mut tracker = HoverTracker::new();

        tracker.step(true, 0);
        tracker.step(true, 140);
        assert_eq!(tracker.step(false, 500), NotchPhase::Expanded);
        assert_eq!(tracker.step(true, 600), NotchPhase::Expanded);
        assert_eq!(tracker.step(true, 2000), NotchPhase::Expanded);
    }

    #[test]
    fn reset_returns_to_a_clean_collapsed_state() {
        let mut tracker = HoverTracker::new();

        tracker.step(true, 0);
        tracker.step(true, 140);
        tracker.reset();

        assert_eq!(tracker.phase(), NotchPhase::Collapsed);
        assert_eq!(tracker.step(false, 1000), NotchPhase::Collapsed);
        assert_eq!(tracker.step(true, 2000), NotchPhase::Hover);
    }
}
