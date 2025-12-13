
import { create } from 'zustand'
import { createJSONStorage, persist } from "zustand/middleware"

enum TourStateValues {
    Todo,
    InProgress,
    Completed
}

enum TourItems {
    // Onboarding flow
    OnboardingIntro,        // First pixel click without wallet - explains app
    NeedsSessionKey,        // Wallet connected, needs session key
    NeedsNickname,          // Ask for nickname if not set
    NeedsTopup,             // Session key created, needs balance
    NeedsAccountInit,       // Balance OK, needs account init + delegation
    OnboardingComplete,     // Everything ready, explain features
    
    // Contextual tour items (triggered by user actions)
    Walkthrough,
    PixelPlaceWithoutLogin,
    ClickedOnLockedShard,
    UnlockedShard,
    CooldownLimitReached,
    CooldownCompleted,
    LowSessionBalance       // Session balance too low for action
}

interface LockedShardInfo {
    x: number;
    y: number;
    onUnlock?: () => void;
}

type TourStateType = {
    items: { [key in TourItems]: TourStateValues }
    lockedShard: LockedShardInfo | null
    actions: {
        complete: (state: TourItems) => void
        start: (state: TourItems) => void
        forceStart: (state: TourItems) => void
        reset: () => void
        setLockedShard: (shard: LockedShardInfo | null) => void
    }
}

const defaultItems = {
    [TourItems.OnboardingIntro]: TourStateValues.Todo,
    [TourItems.NeedsSessionKey]: TourStateValues.Todo,
    [TourItems.NeedsNickname]: TourStateValues.Todo,
    [TourItems.NeedsTopup]: TourStateValues.Todo,
    [TourItems.NeedsAccountInit]: TourStateValues.Todo,
    [TourItems.OnboardingComplete]: TourStateValues.Todo,
    [TourItems.Walkthrough]: TourStateValues.Todo,
    [TourItems.PixelPlaceWithoutLogin]: TourStateValues.Todo,
    [TourItems.ClickedOnLockedShard]: TourStateValues.Todo,
    [TourItems.UnlockedShard]: TourStateValues.Todo,
    [TourItems.CooldownLimitReached]: TourStateValues.Todo,
    [TourItems.CooldownCompleted]: TourStateValues.Todo,
    [TourItems.LowSessionBalance]: TourStateValues.Todo
}

const useTour = create<TourStateType>()(persist((set) => ({
    items: { ...defaultItems },
    lockedShard: null,
    actions: {
        complete: (item: TourItems) => {
            set((state) => ({
                items: {
                    ...state.items,
                    [item]: TourStateValues.Completed
                }
            }))
        },
        start: (item: TourItems) => {
            set((state) => {
                if (state.items[item] === TourStateValues.Todo) {
                    return {
                        items: {
                            ...state.items,
                            [item]: TourStateValues.InProgress
                        }
                    }
                }
                return state
            })
        },
        forceStart: (item: TourItems) => {
            set((state) => {
                return {
                    items: {
                        ...state.items,
                        [item]: TourStateValues.InProgress
                    }
                }
            })
        },
        reset: () => {
            set({
                items: { ...defaultItems }
            })
        },
        setLockedShard: (shard: LockedShardInfo | null) => {
            set({ lockedShard: shard })
        }

    }

}), {
    name: "pixels-world-tour-v3",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ items: state.items }),
}))

const useTourActions = () => { return useTour(state => state.actions) }
const useTourItems = () => { return useTour(state => state.items) }
const useLockedShard = () => { return useTour(state => state.lockedShard) }

export {
    useTourItems,
    useTourActions,
    useLockedShard,

    TourItems,
    TourStateValues
}