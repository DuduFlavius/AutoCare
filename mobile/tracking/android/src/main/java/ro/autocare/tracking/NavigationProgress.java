package ro.autocare.tracking;

final class NavigationProgress {
    record Step(double[][] coordinates, double meters, String instruction) {}
    record Result(int step, double gap, double untilTurn, double remaining, String next) {}

    static Result at(Step[] steps, int fromStep, double latitude, double longitude) {
        int index = fromStep;
        double best = Double.POSITIVE_INFINITY;
        double fraction = 0;
        double scale = 111195 * Math.cos(Math.toRadians(latitude));
        for (int i = fromStep; i < steps.length; i++) {
            double[][] points = steps[i].coordinates();
            double length = 0;
            double nearest = Double.POSITIVE_INFINITY;
            double matched = 0;
            for (int j = 1; j < points.length; j++) {
                double x = (points[j - 1][0] - longitude) * scale;
                double y = (points[j - 1][1] - latitude) * 111195;
                double dx = (points[j][0] - points[j - 1][0]) * scale;
                double dy = (points[j][1] - points[j - 1][1]) * 111195;
                double segment = Math.hypot(dx, dy);
                double ratio = segment == 0 ? 0 : Math.max(0, Math.min(1, -(x * dx + y * dy) / (segment * segment)));
                double gap = Math.hypot(x + ratio * dx, y + ratio * dy);
                if (gap < nearest) {
                    nearest = gap;
                    matched = length + ratio * segment;
                }
                length += segment;
            }
            if (nearest + 3 < best) {
                index = i;
                best = nearest;
                fraction = length == 0 ? 0 : matched / length;
            }
        }
        double until = steps[index].meters() * (1 - fraction);
        double remaining = until;
        for (int i = index + 1; i < steps.length; i++) remaining += steps[i].meters();
        return new Result(index, best, until, remaining, index + 1 < steps.length ? steps[index + 1].instruction() : "");
    }
}
