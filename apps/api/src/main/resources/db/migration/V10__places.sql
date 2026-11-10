-- Where an entry happened, for the map. The coordinates are kept as the author gave them. Other people get
-- them at city level (the API moves the point) unless the author chose to show the exact spot.
alter table entries
  add column lat double precision,
  add column lng double precision,
  add column location_precision text not null default 'none' check (location_precision in ('none', 'city', 'exact')),
  add constraint entries_coordinates check (
    (lat is null and lng is null and location_precision = 'none')
    or (lat between -90 and 90 and lng between -180 and 180 and location_precision <> 'none'));

-- The map reads a journey's entries that have a place, in story order.
create index entries_on_map on entries (journey_id, happened_at, created_at) where lat is not null;
