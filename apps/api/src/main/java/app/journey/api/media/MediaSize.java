package app.journey.api.media;

import java.util.Arrays;
import java.util.Optional;

/**
 * The smaller versions of a photo the app asks for, so a list of faces or a row of cards doesn't download
 * full-size pictures. Small is for profile pictures and little squares; medium for cards and grids.
 */
public enum MediaSize {
  SMALL(320),
  MEDIUM(800);

  private final int width;

  MediaSize(int width) {
    this.width = width;
  }

  /** The longest side, in pixels. */
  public int width() {
    return width;
  }

  public static Optional<MediaSize> ofWidth(Integer width) {
    return Arrays.stream(values()).filter(size -> width != null && size.width == width).findFirst();
  }
}
