package app.journey.api.entry;

import app.journey.api.common.ApiProblem;

/**
 * Where an entry happened: a name to read, and optionally a point for the map. The point is stored as the
 * author gave it; {@link #shownTo} decides what a reader gets.
 */
public record Place(String name, Double lat, Double lng, LocationPrecision precision) {

    /** City level means a grid of about 10 km: enough to put a pin on the right town, never on a doorstep. */
    static final double CITY_GRID = 0.1;

    public static final Place NONE = new Place(null, null, null, LocationPrecision.NONE);

    /** Checks what the app sent. A point needs both numbers; without a say, a point is shown at city level. */
    public static Place of(String name, Double lat, Double lng, LocationPrecision precision) {
        String clean = name == null || name.isBlank() ? null : name.trim();
        if (lat == null && lng == null) {
            return new Place(clean, null, null, LocationPrecision.NONE);
        }
        if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw ApiProblem.badRequest("invalid_place", "That place isn't on the map. Pick it again.");
        }
        if (clean == null) {
            throw ApiProblem.badRequest("place_needs_name", "Give the place a name.");
        }
        boolean said = precision != null && precision != LocationPrecision.NONE;
        return new Place(clean, lat, lng, said ? precision : LocationPrecision.CITY);
    }

    public boolean onMap() {
        return lat != null;
    }

    /**
     * The place as this person may see it. The author sees what they saved. Everyone else gets the exact point
     * only if the author chose that; otherwise the point is moved to the middle of its city-level square, so
     * the real spot can't be worked out from it.
     */
    public Place shownTo(boolean author) {
        if (!onMap() || author || precision == LocationPrecision.EXACT) {
            return this;
        }
        return new Place(name, coarse(lat), coarse(lng), precision);
    }

    /** The middle of the grid square a coordinate falls in. */
    static double coarse(double value) {
        double middle = (Math.floor(value / CITY_GRID) + 0.5) * CITY_GRID;
        return Math.round(middle * 100.0) / 100.0;
    }
}
