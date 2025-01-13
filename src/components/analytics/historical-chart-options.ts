import type { AgChartOptions } from 'ag-charts-community';

export function renderer(
  params: {
    datum: Record<string, number>;
    xKey: string;
    yKey: string;
  },
  title: string,
  color: string,
) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const value = params.datum[params.yKey].toFixed(0);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const date = new Date(params.datum[params.xKey]);

  // Define an array of month names
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Get the month, day, and year from the date
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  // Format the date as "May 19 2024"
  const formattedDate = `${monthName} ${day} ${year}`;
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    content: `${value} on ${formattedDate}`,
    color: '#fff',
    title,
    backgroundColor: color,
  };
}

class HistoricalChartOptions {
  showDaily = true;
  showAcc = true;
  showMa = true;

  showEstimations = false;
  showVotes = true;
  showRooms = false;
  showPageViews = false;
  showNewUsers = false;

  toggleShowDaily() {
    this.showDaily = !this.showDaily;
    return this.toOptions();
  }
  toggleShowAcc() {
    this.showAcc = !this.showAcc;
    return this.toOptions();
  }
  toggleShowMa() {
    this.showMa = !this.showMa;
    return this.toOptions();
  }

  toggleEstimations() {
    this.showEstimations = !this.showEstimations;
    return this.toOptions();
  }
  toggleVotes() {
    this.showVotes = !this.showVotes;
    return this.toOptions();
  }
  toggleRooms() {
    this.showRooms = !this.showRooms;
    return this.toOptions();
  }
  togglePageViews() {
    this.showPageViews = !this.showPageViews;
    return this.toOptions();
  }
  toggleNewUsers() {
    this.showNewUsers = !this.showNewUsers;
    return this.toOptions();
  }

  get leftLegendName() {
    if (this.showDaily && this.showMa) {
      return 'Daily & 30-Day MA';
    } else if (this.showDaily) {
      return 'Daily';
    } else if (this.showMa) {
      return '30-Day MA';
    }
    return '';
  }

  toOptions(): AgChartOptions {
    return {
      theme: 'ag-polychroma-dark',
      background: {
        fill: '#242424',
      },
      height: 600,
      legend: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      tooltip: {
        enabled: true,
      },
      series: [
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'estimations',
          yName: 'Estimations Daily',
          stacked: true,
          visible: this.showEstimations && this.showDaily,
          fill: '#40C057',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Estimations Daily', '#40C057'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_estimations',
          yName: 'Estimations Acc',
          visible: this.showEstimations && this.showAcc,
          strokeWidth: 2,
          stroke: '#40C057',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Estimations Acc', '#40C057'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_estimations',
          yName: 'Estimations MA',
          visible: this.showEstimations && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#40C057',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Estimations MA', '#40C057'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'votes',
          yName: 'Votes Daily',
          stacked: true,
          visible: this.showVotes && this.showDaily,
          fill: '#1971C2',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params) => renderer(params, 'Votes Daily', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_votes',
          yName: 'Votes Acc',
          visible: this.showVotes && this.showAcc,
          strokeWidth: 2,
          stroke: '#1971C2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Votes Acc', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_votes',
          yName: 'Votes MA',
          visible: this.showVotes && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#1971C2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Votes MA', '#1971C2'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'rooms',
          yName: 'Rooms Daily',
          stacked: true,
          visible: this.showRooms && this.showDaily,
          fill: '#8931B2',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params) => renderer(params, 'Rooms Daily', '#8931B2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_rooms',
          yName: 'Rooms Acc',
          visible: this.showRooms && this.showAcc,
          strokeWidth: 2,
          stroke: '#8931B2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Rooms Acc', '#8931B2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_rooms',
          yName: 'Rooms MA',
          visible: this.showRooms && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#8931B2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Rooms MA', '#8931B2'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'page_views',
          yName: 'Pages Views Daily',
          stacked: true,
          visible: this.showPageViews && this.showDaily,
          fill: '#FA5252',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Pages Views Daily', '#FA5252'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_page_views',
          yName: 'Page Views Acc',
          visible: this.showPageViews && this.showAcc,
          strokeWidth: 2,
          stroke: '#FA5252',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Page Views Acc', '#FA5252'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_page_views',
          yName: 'Page Views MA',
          visible: this.showPageViews && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#FA5252',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Page Views MA', '#FA5252'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'new_users',
          yName: 'Unique Users Daily',
          stacked: true,
          visible: this.showNewUsers && this.showDaily,
          fill: '#FAB005',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Unique Users Daily', '#FAB005'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_new_users',
          yName: 'Unique Users Acc',
          visible: this.showNewUsers && this.showAcc,
          strokeWidth: 2,
          stroke: '#FAB005',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Unique Users Acc', '#FAB005'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_new_users',
          yName: 'Unique Users MA',
          visible: this.showNewUsers && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#FAB005',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Unique Users MA', '#FAB005'),
          },
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
        },
        {
          type: 'number',
          position: 'left',
          keys: [
            'estimations',
            'votes',
            'page_views',
            'new_users',
            'rooms',
            'ma_estimations',
            'ma_rooms',
            'ma_votes',
            'ma_page_views',
            'ma_new_users',
          ],
          title: {
            text: this.leftLegendName,
          },
          // label: {
          //   formatter: (params) => {
          //     return params.value / 1000 + 'M';
          //   },
          // },
        },
        {
          type: 'number',
          position: 'right',
          keys: [
            'acc_estimations',
            'acc_rooms',
            'acc_votes',
            'acc_page_views',
            'acc_new_users',
          ],
          title: {
            enabled: true,
            text: 'Accumulated amount',
          },
          // label: {
          //   formatter: (params) => {
          //     return params.value / 1000 + 'k';
          //   },
          // },
        },
      ],
    };
  }
}

export const ChartOptions = new HistoricalChartOptions();
