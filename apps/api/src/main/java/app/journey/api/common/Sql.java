package app.journey.api.common;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/** Small helpers for reading and writing PostgreSQL values with plain SQL. */
public final class Sql {

    private Sql() {}

    public static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    public static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    public static List<String> strings(ResultSet rs, String column) throws SQLException {
        java.sql.Array array = rs.getArray(column);
        return array == null ? List.of() : List.of((String[]) array.getArray());
    }

    /** A PostgreSQL array literal. Only for values already reduced to letters, digits and hyphens. */
    public static String arrayLiteral(List<String> values) {
        return "{" + String.join(",", values) + "}";
    }
}
