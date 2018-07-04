'use strict';

// Object holding DOM elements
const els = Object.freeze({
  display: document.querySelector('.display'),
  sectionCurr: document.querySelector('.current'),
  sectionFore: document.querySelector('.forecast')
});


// DOM-related functions
// Function - make elements, assign className & textContent if present
const makeEls = (elsArr) => {
  const elements = elsArr.map((elObj) => {
    const {el, cls, text} = elObj;
    const newEl = document.createElement(el);
    newEl.className = cls;
    if (text) newEl.textContent = text;

    return newEl;
  });

  return elements;
};

// Function - display error messages in DOM & remove after 3s
const errAlert = (msg='Oh no! Something went wrong!') => {
  if (!document.querySelector('.error')) {
    const [errDiv, errMsg] = makeEls([
      {el: 'div', cls: 'error'},
      {el: 'p', cls: 'msg', text: msg}
    ]);
    errDiv.appendChild(errMsg);
    els.display.insertBefore(errDiv, els.sectionCurr);
    setTimeout(() => {
      document.querySelector('.error').remove();
    }, 4000);
  } 
};

// Function - clear all child elements
const clearKids = (element) => {
  if (element.hasChildNodes()) {
    element.removeChild(element.firstChild);

    return clearKids(element);
  }
};

// Function - append child elements to parent
const appendKids = (parent, children) => {
  return children.map((child) => parent.appendChild(child));
};



/* PERIPHERAL DATA-related FUNCTIONS */
// Function - convert temperature from Kelvin to Celsius & Fahrenheit
const formatTemp = (tempInKelvin) => {
  const celsius = parseFloat((tempInKelvin - 273.15).toFixed(1));
  const fahrenheit = parseFloat((tempInKelvin * 9/5 - 459.67).toFixed(1));

  return {celsius, fahrenheit};
};

// Function - changes 1st letters of passed text to uppercase
const upperFirst = (str) => {
  const strArray = str.split(' ');
  const upperFirstArr = strArray.map((item) => {
    return item[0].toUpperCase() + item.slice(1);
  });
  const upperFirstStr = upperFirstArr.join(' ');

  return upperFirstStr;
};

// Function - extract array of noon (time) forecasts for next 3 days
const nextThreeDayNoonForecasts = (forecast) => {
  const forecastArray = forecast.list;
  const noonForecasts = forecastArray.filter((item) => {
    // filter - accept only forecasts NOT from today and for noon (12:00)
    const today = new Date().getDay(); 
    return (
      new Date(item.dt * 1000).getDay() !== today
      && item.dt_txt.includes('12:00:00')
    );
  });
  const threeDayNoonForecast = noonForecasts.slice(0, 3);

  return threeDayNoonForecast;
};

// Function - get weekday and date from date-time
const getDayDate = (dateTime) => {
  const dateEnd = (date) => {
    const dateArr = date.toString().split('')
    const lastDigit = parseInt(dateArr[dateArr.length - 1]);
    
    return (
      lastDigit === 1 ? 'st' 
      : lastDigit === 2 ? 'nd'
      : lastDigit === 3 ? 'rd' : 'th'
    );
  };
  
  const weekDays = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.' ]  
  const unixTime = new Date(dateTime * 1000);
  const day = weekDays[unixTime.getDay()];
  const dateNum = unixTime.getDate();
  const date = `${dateNum}${dateEnd(dateNum)}`;

  return {day, date};
};



/* CORE FUNCTIONS */
// Data flow: getLocation => getData => formatData => printData

// Function - contains functions for getting user's coordinates
const getLocation = () => {
  // Function - get location by geolocation. - use IP address as alternative
  const getGeoLoc = () => {
    navigator.geolocation.getCurrentPosition(getData, (PositionError) => {
      PositionError.code === 1
        ? errAlert('Browser Geolocation denied by user. Using IP address.')
        : errAlert('Unable to get browser Geolocation. Using IP address.');

      return getIpLoc();
    });
  };

  // Function - get location by IP address
  const getIpLoc = async () => {
    const IPLoc = await fetch('http://ip-api.com/json').then(res => res.json());
    
    return getData(IPLoc);
  };

  navigator.geolocation ? getGeoLoc() : getIpLoc();
};


// Function - contains functions for preparing URLs & making requests
const getData = async (locData) => {
  // Function - prepare urls to make request for weather data
  const prepUrls = (locData) => {
    const lat = locData.lat || locData.coords.latitude;
    const lon = locData.lon || locData.coords.longitude;
    const apiKey = '&appid=5300f8bc54b3884e3240c056f4d4617a';
    const urlBase = 'https://api.openweathermap.org/data/2.5/';
    const urls = {
      currentUrl: `${urlBase}weather?lat=${lat}&lon=${lon}${apiKey}`,
      forecastUrl: `${urlBase}forecast?lat=${lat}&lon=${lon}${apiKey}`
    };

    return urls;
  };

  // Function - fetch request for CURRENT & FORECAST weather data
  const makeRequest = async (urls) => {
    const current = await fetch(urls.currentUrl).then(res => res.json());
    const forecast = await fetch(urls.forecastUrl).then(res => res.json());

    return {current, forecast};
  };
  const reqUrls = prepUrls(locData);
  const data = await makeRequest(reqUrls);

  return formatData(data, printData);
};


// Function - contains functions for formatting current- & forecast weather data
const formatData = (data) => {
  const {current, forecast} = data;
  // Function - extracts & formats relevant data from raw CURRENT weather data 
  const formatCurrentData = (currData) => {
    const {main, wind, weather} = currData;
    // group today's temps. & uppercase 1st letters of weather description 
    const currTemps = [main.temp, main.temp_max, main.temp_min].map(formatTemp);
    const currDescription = upperFirst(weather[0].description);
    // formatted weather data
    const currentFormated = {
      loc: {
        area: currData.name,
        country: currData.sys.country
      },
      temp: {
        now: currTemps[0],
        high: currTemps[1],
        low: currTemps[2]
      },
      humid: main.humidity,
      weather: currDescription,
      wind: wind.speed,
      iconUrl: `https://openweathermap.org/img/w/${weather[0].icon}.png`
    }

    return currentFormated;
  };

  // Function - extracts & formats relevant data from raw FORECAST weather data 
  const formatForecastData = (foreData) => {
    // noon (12:00) forecasts for next 3 days
    const threeDayNoonForecasts = nextThreeDayNoonForecasts(foreData);
    // formatted forecast data
    const forecastsFormatted = threeDayNoonForecasts.map((data) => {
      const dayDate = getDayDate(data.dt);
      const dayTemp = formatTemp(data.main.temp);
      const dayDesc = upperFirst(data.weather[0].description);
      
      return {
        day: dayDate.day,
        date: dayDate.date,
        temp: dayTemp,
        humid: data.main.humidity,
        weather: dayDesc,
        wind: data.wind.speed,
        iconUrl: `https://openweathermap.org/img/w/${data.weather[0].icon}.png`
      };
    });

    return forecastsFormatted;
  };
  const currentFormated = formatCurrentData(current);
  const forecastsFormatted = formatForecastData(forecast);

  return printData({currentFormated, forecastsFormatted});
};


// Function - contains functions for printing data to DOM
const printData = (data) => {
  const {currentFormated, forecastsFormatted} = data;
  // use document fragments to only touch DOM once
  const currFragment = document.createDocumentFragment();
  const foreFragment = document.createDocumentFragment();

  // Function - create template for current weather
  const makeCurrTemplate = (currData) => {
    const {weather, humid, loc, temp, wind, iconUrl} = currData;
    const elsMinusIcon = makeEls([
      {el: 'h2', cls: 'location', text: `${loc.area} - ${loc.country}`},
      {el: 'p', cls: 'temp-cel', text: `${temp.now.celsius}°C`},
      {el: 'p', cls: 'conditions', text: weather},
      {el: 'p', cls: 'wind', text: `Wind speed: ${wind}m/s`},
      {el: 'p', cls: 'humidity', text: `Relative Humidity: ${humid}%`}
    ]);
    const [icon] = makeEls([{el: 'img', cls: 'icon'}]);
    icon.src = iconUrl;
    // °C | °F
    return [...elsMinusIcon, icon];
  };
  
  // Function - print FORECAST data to DOM
  const makeForeTemplates = (dayData, foreArrIndex) => {
    const {day, date, temp, humid, weather, wind, iconUrl} = dayData;
    const [div, ...elsMinusDiv] = makeEls([
      {el: 'div', cls: `forecast-${foreArrIndex}`},
      {el: 'p', cls: 'day-date', text: `${day} ${date}`},
      {el: 'p', cls: 'temp-cel', text: `${temp.celsius}°C`},
      {el: 'p', cls: 'conditions', text: weather},
      {el: 'p', cls: 'wind', text: `Wind Speed: ${wind}m/s`},
      {el: 'p', cls: 'humidity', text: `Relative Humidity: ${humid}%`},
    ]);
    const [icon] = makeEls([{el: 'img', cls: 'icon'}]);
    icon.src = iconUrl;
    appendKids(div, [...elsMinusDiv, icon]);
    
    return div;
  };

  appendKids(currFragment, makeCurrTemplate(currentFormated));
  appendKids(foreFragment, forecastsFormatted.map(makeForeTemplates));

  return (
    els.sectionCurr.appendChild(currFragment),
    els.sectionFore.appendChild(foreFragment)
  );
};


// Call to 'getLocation' func. starts program
// data flow: getLocation => getData => formatData => printData
getLocation();

