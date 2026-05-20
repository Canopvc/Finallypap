import React from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { getNextWorkout, getTodaySteps } from "../widgets/androidWidgetData";
import { NextWorkoutWidget } from "../widgets/NextWorkoutWidget";
import { StepsTodayWidget } from "../widgets/StepsTodayWidget";

export async function syncStepsWidget() {
  await requestWidgetUpdate({
    widgetName: "StepsToday",
    renderWidget: async () => {
      const steps = await getTodaySteps();
      return <StepsTodayWidget steps={steps} />;
    },
  });
}

export async function syncNextWorkoutWidget() {
  await requestWidgetUpdate({
    widgetName: "NextWorkout",
    renderWidget: async () => {
      const nextWorkout = await getNextWorkout();
      return (
        <NextWorkoutWidget
          workoutName={nextWorkout?.name || "Sem treino guardado"}
          exerciseCount={nextWorkout?.exercises?.length ?? 0}
        />
      );
    },
  });
}

export async function syncAllWidgets() {
  try {
    await Promise.all([syncStepsWidget(), syncNextWorkoutWidget()]);
  } catch (error) {
    console.error("widget sync error:", error);
  }
}
