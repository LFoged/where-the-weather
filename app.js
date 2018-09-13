'use strict';

// Object holding DOM elements
const els = Object.freeze({
  display: document.querySelector('.display'),
  sectionCurr: document.querySelector('.current'),
  sectionFore: document.querySelector('.forecasts')
});


/** DOM-RELATED FUNCTIONS **/
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
const errorAlert = (msg='Oh no! Something went wrong!') => {
  if (!document.querySelector('.error-div')) {
    const [errDiv, errMsg] = makeEls([
      {el: 'div', cls: 'error-div'},
      {el: 'p', cls: 'error-msg', text: msg}
    ]);
    errDiv.appendChild(errMsg);
    els.display.insertBefore(errDiv, els.sectionCurr);
    setTimeout(() => {
      document.querySelector('.error-div').remove();
    }, 3500);
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


/* PERIPHERAL DATA-RELATED FUNCTIONS */
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
// FUNC. - try get location through navigator Obj. or IP address
const getLocation = (errAlert) => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (PositionError) => {
      (PositionError.code === 1)
        ? errAlert('Browser Geolocation Denied. Using IP address instead')
        : errAlert('Browser Geolocation Not Supported. Using IP address');

      // on reject, get location through IP address (using 3rd party service)
      reject(fetch('https://ipapi.co/json/'));
    });
  });  
};

// FUNC. - format coordinates into URLs to make requests for weather data
const prepRequestUrls = (locData) => {
  const lat = locData.latitude || locData.coords.latitude;
  const lon = locData.longitude || locData.coords.longitude;
  const apiKey = '&appid=5300f8bc54b3884e3240c056f4d4617a';
  const urlBase = 'https://api.openweathermap.org/data/2.5/';
  const urls = {
    currentUrl: `${urlBase}weather?lat=${lat}&lon=${lon}${apiKey}`,
    forecastUrl: `${urlBase}forecast?lat=${lat}&lon=${lon}${apiKey}`
  };

  return urls;
};

// FUNC. - make request for weather data
const getWeatherData = async (urls, errAlert) => {
  try {
    const current = await fetch(urls.currentUrl).then(res => res.json());
    const forecast = await fetch(urls.forecastUrl).then(res => res.json());

    return {current, forecast};
  }
  catch(err) { return errAlert(); }
};

// FUNC. - format data for current weather
const formatCurrentData = (currData) => {
  const {main, wind, weather} = currData;
  // group today's temps. & uppercase 1st letters of weather description 
  const currTemps = [main.temp, main.temp_max, main.temp_min].map(formatTemp);
  const currDescription = upperFirst(weather[0].description);
  // formatted weather data
  return ({
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
  });
};

// FUNC. - format data for weather forecast
const formatForecastData = (foreData) => {
  // noon (12:00) forecasts for next 3 days
  const threeDayNoonForecasts = nextThreeDayNoonForecasts(foreData);
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


// Function - contains functions for printing data to DOM
const printData = (data) => {
  const {currentFormatted, forecastsFormatted} = data;
  // use document fragments to only touch DOM once
  const currentFragment = document.createDocumentFragment();
  const forecastsFragment = document.createDocumentFragment();

  // Function - create template for current weather
  const makeCurrentTemplate = (currData) => {
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
  
  // Function - create template for weather forecast
  const makeForecastTemplates = (dayData, foreArrIndex) => {
    const {day, date, temp, humid, weather, wind, iconUrl} = dayData;
    const [div, ...elsMinusDiv] = makeEls([
      {el: 'div', cls: `forecast day-${foreArrIndex}`},
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

  appendKids(currentFragment, makeCurrentTemplate(currentFormatted));
  appendKids(forecastsFragment, forecastsFormatted.map(makeForecastTemplates));

  return (
    els.sectionCurr.appendChild(currentFragment),
    els.sectionFore.appendChild(forecastsFragment)
  );
};


// FUNC. - 'ctrl' (control), initiates & controls flow of program
// data flow: getLocation => getData => formatData => printData
const ctrl = ( async (errorAlert) => {
  // get location from browser (on resolve) or fetch() IP address (on reject)
  const coordinates = await getLocation(errorAlert)
    .catch(ipLocate => ipLocate.then(res => res.json()).catch(console.error));
  const requestUrls = prepRequestUrls(coordinates);
  const weatherData = await getWeatherData(requestUrls, errorAlert);
  const {current, forecast} = weatherData;
  const currentFormatted = formatCurrentData(current);
  const forecastsFormatted = formatForecastData(forecast);
  printData({currentFormatted, forecastsFormatted})
})(errorAlert);
