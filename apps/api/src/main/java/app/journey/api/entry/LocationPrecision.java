package app.journey.api.entry;

import app.journey.api.common.ApiProblem;
import app.journey.api.common.Codes;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * How closely an entry's place is shown to other people: not at all, at city level (the default), or the
 * exact spot, which only the author can choose.
 */
public enum LocationPrecision {
    NONE,
    CITY,
    EXACT;

    @JsonValue
    public String code() {
        return Codes.of(this);
    }

    @JsonCreator
    public static LocationPrecision of(String code) {
        return Codes.parse(
                LocationPrecision.class,
                code,
                () -> ApiProblem.badRequest("invalid_precision", "Choose the city or the exact spot."));
    }

    /** From a database column. */
    public static LocationPrecision read(String code) {
        return Codes.read(LocationPrecision.class, code);
    }
}
