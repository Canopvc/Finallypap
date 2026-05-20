import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { getNextWorkout, getTodaySteps } from "./widgets/androidWidgetData";
import { NextWorkoutWidget } from "./widgets/NextWorkoutWidget";
import { StepsTodayWidget } from "./widgets/StepsTodayWidget";

async function renderStepsWidget(props: WidgetTaskHandlerProps) {
  const steps = await getTodaySteps();
  props.renderWidget(<StepsTodayWidget steps={steps} />);
}

async function renderNextWorkoutWidget(props: WidgetTaskHandlerProps) {
  const nextWorkout = await getNextWorkout();
  props.renderWidget(
    <NextWorkoutWidget
      workoutName={nextWorkout?.name || "Sem treino guardado"}
      exerciseCount={nextWorkout?.exercises?.length ?? 0}
    />,
  );
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetName = props.widgetInfo.widgetName;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
    case "WIDGET_CLICK":
      if (widgetName === "StepsToday") {
        await renderStepsWidget(props);
      } else if (widgetName === "NextWorkout") {
        await renderNextWorkoutWidget(props);
      }
      break;
    case "WIDGET_DELETED":
    default:
      break;
  }
}
