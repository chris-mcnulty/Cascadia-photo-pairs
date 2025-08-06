import { Photo, Settings } from "@shared/schema";
import PhotoPair from "./photo-pair";

interface VotingInterfaceProps {
  photoPair: [Photo, Photo];
  onVote: (winner: Photo, loser: Photo) => void;
  isVoting: boolean;
  settings?: Settings;
}

export default function VotingInterface({ photoPair, onVote, isVoting, settings }: VotingInterfaceProps) {
  const [photoA, photoB] = photoPair;

  return (
    <div className="mb-12">
      <div className="grid md:grid-cols-2 gap-8">
        <PhotoPair
          photo={photoA}
          onVote={() => onVote(photoA, photoB)}
          isVoting={isVoting}
          settings={settings}
        />
        <PhotoPair
          photo={photoB}
          onVote={() => onVote(photoB, photoA)}
          isVoting={isVoting}
          settings={settings}
        />
      </div>
    </div>
  );
}
