use serde::Serialize;

use crate::app::hover::NotchPhase;

#[derive(Clone, Serialize)]
pub struct NotchState {
    pub phase: NotchPhase,
}
