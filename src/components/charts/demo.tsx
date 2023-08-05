import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { type ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const DemoChart = (props: {
  pageViews: { count: number; viewDate: string }[] | undefined;
}) => {
  const { pageViews } = props;

  const [options] = useState<ApexOptions>({
    chart: {
      id: "basic-bar",
      foreColor: "#C1C2C5",
    },
    xaxis: {
      type: "datetime",
    },
    stroke: {
      colors: ["#1971c2"], //Here you provide the blue color for the line graph
    },
    colors: ["#1971c2"],
    tooltip: {
      fillSeriesColor: false, //This is for the tooltip color
      theme: "dark", //You will need to work with this option to apply the dark theme.
    },
    theme: {
      palette: "palette2", //Check the list of available palettes and choose one.
    },
    grid: { borderColor: "#3e3e3e" },
  });

  const [series, setSeries] = useState<
    ApexAxisChartSeries | ApexNonAxisChartSeries
  >([
    {
      name: "series-1",
      data: [],
    },
  ]);

  useEffect(() => {
    if (!pageViews) {
      return;
    }
    setSeries([
      {
        name: "series-1",
        data: [
          {
            y: pageViews.map((pageView) => pageView.count) ?? ([] as number[]),
            x: pageViews.map((pageView) => pageView.viewDate) ?? [],
          },
        ],
      },
    ]);
  }, [pageViews]);

  return (
    <div className="h-[400px] w-full">
      <Chart
        options={options}
        series={series}
        type="line"
        width="100%"
        height="100%"
      />
    </div>
  );
};
