-- Search finds a journey by the places its entries happened in ("hoi an"), anywhere in the name.
create index entries_place_trgm on entries using gin (place_name gin_trgm_ops) where place_name is not null;
