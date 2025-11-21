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
        <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : userLevel ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Level & Icon */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-primary/10 p-1.5">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-muted-foreground">Level</span>
                  <span className="text-lg font-bold">{userLevel.level}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {userLevel.totalMints} mint{userLevel.totalMints !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Center: Progress Bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">
                  {userLevel.experience}/{userLevel.nextLevelMints + userLevel.experience} XP
                </span>
                <span className="text-xs text-muted-foreground">
                  {userLevel.nextLevelMints} to next
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      (userLevel.experience / Math.max(userLevel.nextLevelMints, 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load profile"}
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </>
  );
};

