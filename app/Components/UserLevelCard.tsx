import { Loader2, Trophy } from "lucide-react"
import { UserLevel } from "../utils/api";

interface UserLevelCardProps {
    isLoading: boolean;
    userLevel: UserLevel | null;
    error: Error | null;
    refetch: () => void;
}

export const UserLevelCard = ( { isLoading, userLevel, error, refetch }: UserLevelCardProps ) => {
  return (
    <>
    {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : userLevel ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Level {userLevel.level}</h2>
                <p className="text-sm text-muted-foreground">
                  {userLevel.totalMints} NFTs minted
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                Next level in
              </p>
              <p className="text-lg font-semibold">
                {userLevel.nextLevelMints} mints
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 mb-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (userLevel.experience / Math.max(userLevel.nextLevelMints, 1)) * 100,
                  100
                )}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {userLevel.experience} / {userLevel.nextLevelMints + userLevel.experience} experience
          </p>
        </div>
      ) : null}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Failed to load profile"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
};

