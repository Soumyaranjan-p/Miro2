import { useModel } from "../../app/model";
import { Artwork } from "../controls/Artwork";
import { IconButton } from "../controls/IconButton";
import { Scrubber } from "../controls/Scrubber";
import { PauseIcon, PlayIcon } from "../../ui/icons";
import { EmptyState } from "./EmptyState";

export function MusicPage() {
  const { snapshot, togglePlay, seek } = useModel();
  const media = snapshot.media;

  if (!media) {
    return (
      <EmptyState
        title="Nothing playing"
        hint="Start a track and it lands here."
      />
    );
  }

  return (
    <div className="page music-page">
      <div className="music-top">
        <Artwork title={media.title} artist={media.artist} />

        <div className="music-meta">
          <p className="t-title music-title">{media.title}</p>
          <p className="t-body music-artist">{media.artist}</p>
        </div>

        <div className="music-controls">
          <IconButton
            label={media.playing ? "Pause" : "Play"}
            primary
            onClick={togglePlay}
          >
            {media.playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
        </div>
      </div>

      <Scrubber
        positionMs={media.positionMs}
        durationMs={media.durationMs}
        onSeek={seek}
      />
    </div>
  );
}
