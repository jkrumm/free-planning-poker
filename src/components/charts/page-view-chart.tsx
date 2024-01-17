import React, { useState } from 'react';

import dynamic from 'next/dynamic';

import { type ApexOptions } from 'apexcharts';

import { type PageViews } from 'fpp/server/api/routers/tracking.router';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export const PageViewChart = ({ pageViews }: { pageViews: PageViews }) => {
  const [options] = useState<ApexOptions>({
    chart: {
      id: 'basic-bar',
      foreColor: '#C1C2C5',
      animations: {
        enabled: false,
      },
    },
    xaxis: {
      type: 'datetime',
    },
    noData: { text: 'Loading...' },
    colors: ['#1971c2'],
    tooltip: {
      fillSeriesColor: true, //This is for the tooltip color
      theme: 'dark', //You will need to work with this option to apply the dark theme.
    },
    theme: {
      palette: 'palette2', //Check the list of available palettes and choose one.
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    grid: { borderColor: '#3e3e3e' },
  });

  const [series] = useState<ApexAxisChartSeries | ApexNonAxisChartSeries>([
    {
      name: 'Total page views',
      color: '#1971c2',
      data: pageViews.totalViews.map((pageView) => ({
        x: pageView.date,
        y: pageView.count,
      })),
    },
    {
      name: 'Unique visitors',
      color: '#2F9E44',
      data: pageViews.uniqueViews.map((pageView) => ({
        x: pageView.date,
        y: pageView.count,
      })),
    },
    {
      name: 'Total estimations',
      color: '#F08C00',
      data: pageViews.totalVotes.map((pageView) => ({
        x: pageView.date,
        y: pageView.count,
      })),
    },
  ]);

  return (
    <div className="h-[600px] w-full">
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
