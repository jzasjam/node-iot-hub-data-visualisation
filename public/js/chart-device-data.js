/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
    // UPDATED TO INCLUDE ADDITIONAL SENSEHAT DATA
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.temperatureData = new Array(this.maxLen);
      this.humidityData = new Array(this.maxLen);
      this.pressureData = new Array(this.maxLen);
      this.accelData = new Array(this.maxLen);
      this.compassData = new Array(this.maxLen);
      this.gyroData = new Array(this.maxLen);
    }

    addData(time, temperature, humidity, pressure, accel, compass, gyro) {
      this.timeData.push(time);
      this.temperatureData.push(temperature);
      this.humidityData.push(humidity || null);
      this.pressureData.push(pressure || null);
      this.accelData.push(accel || null);
      this.compassData.push(compass || null);
      this.gyroData.push(gyro || null);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.temperatureData.shift();
        this.humidityData.shift();
        this.pressureData.shift();
        this.accelData.shift();
        this.compassData.shift();
        this.gyroData.shift();
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Define the chart axes
  const chartData = {
    datasets: [
      {
        fill: true,
        label: 'Temperature',
        yAxisID: 'Temperature',
        borderColor: 'rgba(140, 50, 180, 1)',
        pointBoarderColor: 'rgba(140, 50, 180, 1)',
        backgroundColor: 'rgba(140, 50, 180, 0.4)',
        pointHoverBackgroundColor: 'rgba(140, 50, 180, 1)',
        pointHoverBorderColor: 'rgba(140, 50, 180, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Humidity',
        yAxisID: 'Humidity',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [{
        id: 'Temperature',
        type: 'linear',
        scaleLabel: {
          labelString: 'Temperature (ºC)',
          display: true,
        },
        position: 'right',
      },
      {
        id: 'Humidity',
        type: 'linear',
        scaleLabel: {
          labelString: 'Humidity (%)',
          display: true,
        },
        position: 'left',
      }]
    }
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.temperatureData;
    chartData.datasets[1].data = device.humidityData;
    myLineChart.update();

    // Clear the charts / Return to Default
    //------------------
    $('#truck-front').css({transform:'rotate(0deg)'})
    $('#truck').css({transform:'rotate(0deg)'})
    drawSensehatAccelerometerBarChart();
    drawSensehatAccelerometerYColumnChart();
    drawSensehatAccelerometerChart();
    drawSensehatGyroscopeChart();
    drawSensehatCompassChart();
    // SET THE 3D OBJECT TO DEFAULT POSITION
    setCubeRotation(0,0,0);

  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      //console.log(messageData);

      // time and either temperature or humidity are required
      if (!messageData.MessageDate || (!messageData.IotData.temperature && !messageData.IotData.humidity)) {
        //return;
      }

      // find or add device to list of tracked devices
      const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

      // format messageData.MessageDate to be more readable
      var date = new Date(messageData.MessageDate);
      var dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
      // If today, only show time
      if (date.toLocaleDateString() === new Date().toLocaleDateString()) {
        dateStr = date.toLocaleTimeString();
      }
      messageData.MessageDate = dateStr;
      
      // HANDLE DATA COMING FROM SAMSUNG S9 VIA IoT PLUG AND PLAY APP (diferent attributes names)
        if(messageData.DeviceId=='SamsungS9') {
          //alert(messageData.DeviceId);
          messageData.IotData.accel = messageData.IotData.accelerometer
          messageData.IotData.gyro = messageData.IotData.gyroscope
          messageData.IotData.compass = messageData.IotData.magnetometer
        }

      if (existingDeviceData) {
        existingDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, messageData.IotData.humidity, messageData.IotData.pressure, messageData.IotData.accel, messageData.IotData.compass, messageData.IotData.gyro);
      } else {


        const newDeviceData = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(newDeviceData);
        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;
        
        newDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, messageData.IotData.humidity, messageData.IotData.pressure, messageData.IotData.accel, messageData.IotData.compass, messageData.IotData.gyro);

        // add device to the UI list
        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

      myLineChart.update();
      
      const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
      
      // DRAW THE CHARTS WITH LATEST DATA
      if(device.compassData[device.compassData.length - 1] && device.compassData[device.compassData.length - 1].x != null){
        compass = device.compassData[device.compassData.length - 1];
        drawSensehatCompassChart(compass);
      }

      if(device.gyroData[device.gyroData.length - 1] && device.gyroData[device.gyroData.length - 1].x != null){
        gyro = device.gyroData[device.gyroData.length - 1];
        drawSensehatGyroscopeChart(gyro);
      }

      temp = device.temperatureData[device.temperatureData.length - 1];
      // Round temp to 0 decimal places
      temp = Math.round(temp * 10) / 10;
      drawSenseHatTemperatureGuage(temp);
      //console.log("Temperature: " + temp + "ºC");

      // IF THE DEVICE HAS ACCELEROMETER DATA, UPDATE THE CHARTS AND VISUALS
      if(device.accelData[device.accelData.length - 1] && device.accelData[device.accelData.length - 1].x != null){
        
        $('#truck-front').css({transform:'rotate(0deg)'})
        $('#truck').css({transform:'rotate(0deg)'})
        accel = device.accelData[device.accelData.length - 1];
        drawSensehatAccelerometerChart(accel);
        drawSensehatAccelerometerBarChart(accel)
        drawSensehatAccelerometerYColumnChart(accel)
        
        // GET THE LATEST ACCELEROMETER AXIS VALUES
        accelX = device.accelData[device.accelData.length - 1].x;
        accelY = device.accelData[device.accelData.length - 1].y;
        accelZ = device.accelData[device.accelData.length - 1].z;
        
        // HANDLE DATA COMING FROM SAMSUNG S9 VIA IoT PLUG AND PLAY APP (diferent value range)
        if(device.deviceId=='SamsungS9'){
          accelX = -(device.accelData[device.accelData.length - 1].x)/10;
          accelY = (device.accelData[device.accelData.length - 1].y)/10;
          accelZ = (device.accelData[device.accelData.length - 1].z)/10;
        }

        // ROTATE ICONS
        $('#truck-front').css({transform:'rotate('+ -(accelX*90) +'deg)'})
        $('#truck').css({transform:'rotate('+ -(accelY*90) +'deg)'})

        // ROTATE THE 3D OBJECT
        setCubeRotation(accelX, accelY, accelZ);
        document.getElementById("3d-render").style.display = "block";

      } else {
        //document.getElementById("3d-render").style.display = "none";
      }


    } catch (err) {
      console.error(err);
    }
  };
});
