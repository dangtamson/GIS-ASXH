import type ActionIcon from "@/components/controller/ActionIcon";

export type HouseholdExtraActionKey = "collection" | "assessmentTimeline" | "supportTimeline" | "map" | "delete";

export type HouseholdExtraActionDefinition = {
    key: HouseholdExtraActionKey;
    label: string;
    iconAction: Parameters<typeof ActionIcon>[0]["action"];
    visible: boolean;
    danger?: boolean;
};

export function getVisibleHouseholdExtraActions(actions: HouseholdExtraActionDefinition[]): HouseholdExtraActionDefinition[] {
    return actions.filter((action) => action.visible);
}
