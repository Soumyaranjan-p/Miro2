pub fn top_center_rect(
    monitor_x: i32,
    monitor_y: i32,
    monitor_width: u32,
    scale: f64,
    logical_width: f64,
    logical_height: f64,
) -> (i32, i32, u32, u32) {
    let width = (logical_width * scale).round().max(1.0) as u32;
    let height = (logical_height * scale).round().max(1.0) as u32;
    let centered = monitor_x + (monitor_width as i32 - width as i32) / 2;
    (centered.max(monitor_x), monitor_y, width, height)
}

#[cfg(test)]
mod tests {
    use super::top_center_rect;

    #[test]
    fn centers_collapsed_and_expanded_on_1080p() {
        assert_eq!(
            top_center_rect(0, 0, 1920, 1.0, 152.0, 30.0),
            (884, 0, 152, 30)
        );
        assert_eq!(
            top_center_rect(0, 0, 1920, 1.0, 420.0, 150.0),
            (750, 0, 420, 150)
        );
    }

    #[test]
    fn scales_for_each_dpi_step() {
        assert_eq!(
            top_center_rect(0, 0, 2560, 1.25, 420.0, 150.0),
            (1017, 0, 525, 188)
        );
        assert_eq!(
            top_center_rect(0, 0, 3840, 1.5, 420.0, 150.0),
            (1605, 0, 630, 225)
        );
        assert_eq!(
            top_center_rect(0, 0, 3840, 2.0, 420.0, 150.0),
            (1500, 0, 840, 300)
        );
    }

    #[test]
    fn follows_a_negative_origin_monitor() {
        assert_eq!(
            top_center_rect(-1920, 0, 1920, 1.0, 152.0, 30.0),
            (-1036, 0, 152, 30)
        );
        assert_eq!(
            top_center_rect(1920, -200, 1920, 1.0, 420.0, 150.0),
            (2670, -200, 420, 150)
        );
    }

    #[test]
    fn clamps_to_the_monitor_edge_when_too_narrow() {
        assert_eq!(
            top_center_rect(100, 50, 100, 1.0, 152.0, 30.0),
            (100, 50, 152, 30)
        );
    }
}
