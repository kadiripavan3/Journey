-- Short video clips. A clip goes to the video service, which converts it for streaming; until that is done it
-- is "processing", and only the person who uploaded it sees it.
alter table media drop constraint media_status_check;
alter table media add constraint media_status_check check (status in ('pending', 'processing', 'ready', 'failed'));

alter table media
  add column video_upload_id text,  -- the video service's id for the upload
  add column video_asset_id text,   -- its id for the converted clip, needed to delete it there
  add column playback_id text;      -- what the player asks the video service for

create unique index media_video_upload on media (video_upload_id) where video_upload_id is not null;
