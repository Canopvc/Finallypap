import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

type Props = {
  steps: number;
};

const colorText = "#FFFFFF";

function getColorText(steps: number) {
  if(parseInt(steps.toLocaleString("pt-PT")) >= 10000) {
    return "#D9451A";
  }
  return "#FFFFFF";
}

export function StepsTodayWidget({ steps }: Props) {
  const colorText = getColorText(steps);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#111827",
        borderRadius: 18,
        padding: 16,
        justifyContent: "space-between",
      }}
    >
      <TextWidget
        text="Passos de Hoje"
        style={{ color: "#9CA3AF", fontSize: 14, fontWeight: "500" }}
      />
      <TextWidget
        text={`${steps.toLocaleString("pt-PT")}`}
        style={{ color: getColorText(steps), fontSize: 30, fontWeight: "700" }}
      />
      <TextWidget
        text="Toque para abrir a app"
        style={{ color: "#34D399", fontSize: 12 }}
      />
    </FlexWidget>
  );
}
