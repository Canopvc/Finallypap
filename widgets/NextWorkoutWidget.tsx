import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

type Props = {
  workoutName: string;
  exerciseCount: number;
};

export function NextWorkoutWidget({ workoutName, exerciseCount }: Props) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#0F172A",
        borderRadius: 18,
        padding: 16,
        justifyContent: "space-between",
      }}
    >
      <TextWidget
        text="Proximo Treino"
        style={{ color: "#94A3B8", fontSize: 14, fontWeight: "500" }}
      />
      <TextWidget
        text={workoutName}
        maxLines={2}
        truncate="END"
        style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}
      />
      <TextWidget
        text={`${exerciseCount} exercicios`}
        style={{ color: "#60A5FA", fontSize: 12 }}
      />
    </FlexWidget>
  );
}
