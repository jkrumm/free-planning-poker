import type { AgChartOptions } from 'ag-charts-community';

function renderer(
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

  showEstimations = false;
  showAccEstimations = false;
  showVotes = true;
  showAccVotes = true;
  showRooms = false;
  showAccRooms = false;
  showPageViews = false;
  showAccPageViews = false;
  showNewUsers = false;
  showAccNewUsers = false;

  toggleShowDaily() {
    this.showDaily = !this.showDaily;
    return this.toOptions();
  }
  toggleShowAcc() {
    this.showAcc = !this.showAcc;
    return this.toOptions();
  }

  toggleEstimations() {
    this.showEstimations = !this.showEstimations;
    this.showAccEstimations = !this.showAccEstimations;
    return this.toOptions();
  }
  toggleVotes() {
    this.showVotes = !this.showVotes;
    this.showAccVotes = !this.showAccVotes;
    return this.toOptions();
  }
  toggleRooms() {
    this.showRooms = !this.showRooms;
    this.showAccRooms = !this.showAccRooms;
    return this.toOptions();
  }
  togglePageViews() {
    this.showPageViews = !this.showPageViews;
    this.showAccPageViews = !this.showAccPageViews;
    return this.toOptions();
  }
  toggleNewUsers() {
    this.showNewUsers = !this.showNewUsers;
    this.showAccNewUsers = !this.showAccNewUsers;
    return this.toOptions();
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
          fillOpacity: this.showAcc ? 0.2 : 1,
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
          visible: this.showAccEstimations && this.showAcc,
          strokeWidth: 2,
          stroke: '#40C057',
          marker: {
            enabled: false,
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Estimations Acc', '#40C057'),
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
          fillOpacity: this.showAcc ? 0.2 : 1,
          tooltip: {
            renderer: (params) => renderer(params, 'Votes Daily', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_votes',
          yName: 'Votes Acc',
          visible: this.showAccVotes && this.showAcc,
          strokeWidth: 2,
          stroke: '#1971C2',
          marker: {
            enabled: false,
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Votes Acc', '#1971C2'),
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
          fillOpacity: this.showAcc ? 0.2 : 1,
          tooltip: {
            renderer: (params) => renderer(params, 'Rooms Daily', '#8931B2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_rooms',
          yName: 'Rooms Acc',
          visible: this.showAccRooms && this.showAcc,
          strokeWidth: 2,
          stroke: '#8931B2',
          marker: {
            enabled: false,
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Rooms Acc', '#8931B2'),
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
          fillOpacity: this.showAcc ? 0.2 : 1,
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
          visible: this.showAccPageViews && this.showAcc,
          strokeWidth: 2,
          stroke: '#FA5252',
          marker: {
            enabled: false,
          },
          tooltip: {
            renderer: (params) => renderer(params, 'Page Views Acc', '#FA5252'),
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
          fillOpacity: this.showAcc ? 0.2 : 1,
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
          visible: this.showAccNewUsers && this.showAcc,
          strokeWidth: 2,
          stroke: '#FAB005',
          marker: {
            enabled: false,
          },
          tooltip: {
            renderer: (params) =>
              renderer(params, 'Unique Users Acc', '#FAB005'),
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
          keys: ['estimations', 'votes', 'page_views', 'new_users', 'rooms'],
          title: {
            text: 'Daily amount',
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
