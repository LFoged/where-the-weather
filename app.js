'use strict';

/* 'UTILITY' FUNCTIONS */
const UTILS = (() => {
  const _doc = document;

  // make elements, assign className & textContent if present
  const makeEls = (elsArr) => {
    const elements = elsArr.map((elObj) => {
      const { el, cls, text } = elObj;
      const newEl = _doc.createElement(el);
      newEl.className = cls;
      if (text) newEl.textContent = text;

      return newEl;
    });

    return elements;
  };

  // append elements to parent element (element not on DOM)
  const appendKids = (parent, children) => {
    return children.map((child) => parent.appendChild(child));
  };

  return Object.freeze({ makeEls, appendKids });
})();


/** DOM-RELATED FUNCTIONS **/
const DOM = ((UTILS) => {
  const { makeEls, appendKids } = UTILS;
  const _doc = document;

  // remove element after x millisecond delay - used by 'errorAlert'
  const _delayedRemoveEl = (elQuerySelector, delay) => {
    setTimeout(() => {
      document.querySelector(elQuerySelector).remove();
    }, delay);
  };

  // DOM elements
  const els = Object.freeze({
    errDisplay: _doc.querySelector('.error-display'),
    loadingSpinner: _doc.querySelector('.spinner'),
    sectionCurr: _doc.querySelector('.current'),
    sectionFore: _doc.querySelector('.forecasts')
  });

  // templates for displaying alerts & weather data
  const templates = Object.freeze({
    alert: (msg) => {
      const [errDiv, errMsg] = makeEls([
        { el: 'div', cls: 'error-div' },
        { el: 'p', cls: 'error-msg', text: msg }
      ]);
      errDiv.appendChild(errMsg);

      return errDiv;
    },

    current: (currData) => {
      const { weather, humid, loc, temp, wind, iconUrl } = currData;
      const currentFragment = _doc.createDocumentFragment();
      const elsMinusIcon = makeEls([
        { el: 'h2', cls: 'location', text: `${loc.area} - ${loc.country}` },
        {
          el: 'p',
          cls: 'temp',
          text: `${temp.celsius}°C | ${temp.fahrenheit}°F`
        },
        { el: 'p', cls: 'conditions', text: weather },
        { el: 'p', cls: 'wind', text: `Wind speed: ${wind}m/s` },
        { el: 'p', cls: 'humidity', text: `Relative Humidity: ${humid}%` }
      ]);
      const [icon] = makeEls([{ el: 'img', cls: 'icon' }]);
      icon.src = iconUrl;
      appendKids(currentFragment, [...elsMinusIcon, icon]);

      return currentFragment;
    },

    forecast: (forecastsArray) => {
      const forecastsFragment = document.createDocumentFragment();
      const forecastElements = forecastsArray.map((dayData, foreArrIndex) => {
        const { day, date, temp, humid, weather, wind, iconUrl } = dayData;
        const [div, ...elsMinusDiv] = makeEls([
          { el: 'div', cls: `forecast day-${foreArrIndex}` },
          { el: 'p', cls: 'day-date', text: `${day} ${date}` },
          {
            el: 'p',
            cls: 'temp-cel',
            text: `${temp.celsius}°C | ${temp.fahrenheit}°F`
          },
          { el: 'p', cls: 'conditions', text: weather },
          { el: 'p', cls: 'wind', text: `Wind Speed: ${wind}m/s` },
          { el: 'p', cls: 'humidity', text: `Relative Humidity: ${humid}%` },
        ]);
        const [icon] = makeEls([{ el: 'img', cls: 'icon' }]);
        icon.src = iconUrl;
        appendKids(div, [...elsMinusDiv, icon]);

        return div;
      });
      appendKids(forecastsFragment, forecastElements);

      return forecastsFragment;
    }
  });

  // display error messages in DOM & remove after x milliseconds
  const errorAlert = (msg = 'Oh no! Something went wrong!') => {
    if (!document.querySelector('.error-div')) {
      const delay = 2700;
      const errDiv = templates.alert(msg);
      printer(errDiv, els.errDisplay);
      _delayedRemoveEl('.error-div', delay);
    }
  };

  // append element to DOM element
  const printer = (element, target) => target.appendChild(element);

  return Object.freeze({ els, templates, errorAlert, printer });
})(UTILS);


/* CORE DATA FUNCTIONS */
const DATA = (() => {
  // get location through navigator Obj. or IP address
  const getLocation = (errorAlert) => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, (PositionError) => {
        const errorMessages = {
          1: 'Browser Geolocation Blocked. Using IP Address Instead.',
          2: 'Browser Geolocation Not Supported. Using IP Address Instead.',
        };
        errorAlert(errorMessages[PositionError.code] || '');

        // on reject, get location through IP address (using 3rd party service)
        return reject(fetch('https://ipapi.co/json/'));
      });
    });
  };

  // format coordinates into URLs to make requests for weather data
  const prepRequestUrls = (locData) => {
    const lat = locData.latitude || locData.coords.latitude;
    const lon = locData.longitude || locData.coords.longitude;
    const query = `lat=${lat}&lon=${lon}`;
    const key = '&appid=5300f8bc54b3884e3240c056f4d4617a';
    const urlBase = 'https://api.openweathermap.org/data/2.5/';
    const urls = {
      currentUrl: `${urlBase}weather?${query}${key}`,
      forecastUrl: `${urlBase}forecast?${query}${key}`
    };

    return urls;
  };

  // FUNC. - make request for weather data
  const getWeatherData = async (urls, errorAlert) => {
    try {
      const [current, forecast] = await Promise.all([
        fetch(urls.currentUrl).then(res => res.json()),
        fetch(urls.forecastUrl).then(res => res.json())
      ]);

      return { current, forecast };
    }
    catch (err) { return errorAlert(); }
  };

  return Object.freeze({ getLocation, prepRequestUrls, getWeatherData });
})();


/* 'PERIPHERAL' DATA-FORMATTING FUNCTIONS */
const AUX = (() => {
  // convert temperature from Kelvin to Celsius & Fahrenheit
  const _formatTemp = (tempInKelvin) => {
    const celsius = parseFloat((tempInKelvin - 273.15).toFixed(1));
    const fahrenheit = parseFloat((tempInKelvin * 9 / 5 - 459.67).toFixed(1));

    return { celsius, fahrenheit };
  };

  // changes 1st letters of passed text to uppercase
  const _upperFirst = (str) => {
    const strArray = str.split(' ');
    const upperFirstArr = strArray.map((item) => {
      return item[0].toUpperCase() + item.slice(1);
    });
    const upperFirstStr = upperFirstArr.join(' ');

    return upperFirstStr;
  };

  // extract array of noon (time) forecasts for next 3 days
  const _noonForecasts = (forecast) => {
    const forecastArray = forecast.list;
    const noonForecasts = forecastArray.filter((item) => {
      // filter - accept only forecasts NOT from today and for noon (12:00)
      const today = new Date().getDay();
      return (
        new Date(item.dt * 1000).getDay() !== today
        && item.dt_txt.includes('12:00:00')
      );
    });

    return noonForecasts;
  };

  // get weekday and date from date-time
  const _getDayDate = (dateTime) => {
    // return appropriate 2 letter suffix for date
    const dateSuffix = (date) => {
      // suffixes for 11, 12 & 13 = 'th' instead of 'st', 'nd' & 'rd'
      const specialCases = [11, 12, 13];
      if (specialCases.includes(date)) return 'th';
      const dateLastDigit = date.toString().split('').pop();
      const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };

      return suffixes[dateLastDigit] || 'th';
    };

    const weekDays = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.']
    const unixTime = new Date(dateTime * 1000);
    const day = weekDays[unixTime.getDay()];
    const dateNum = unixTime.getDate();
    const date = `${dateNum}${dateSuffix(dateNum)}`;

    return { day, date };
  };

  // format data for current weather
  const formatCurrentData = (currData) => {
    const { main, wind, weather } = currData;
    // group today's temps. & uppercase 1st letters of weather description
    const currentTemp = _formatTemp(main.temp);
    const currDescription = _upperFirst(weather[0].description);
    // formatted weather data
    return ({
      loc: {
        area: currData.name,
        country: currData.sys.country
      },
      temp: currentTemp,
      humid: main.humidity,
      weather: currDescription,
      wind: wind.speed,
      iconUrl: `https://openweathermap.org/img/w/${weather[0].icon}.png`
    });
  };

  // format data for weather forecast
  const formatForecastData = (foreData) => {
    const threeDayNoonForecasts = _noonForecasts(foreData);
    const forecastsFormatted = threeDayNoonForecasts.map((data) => {
      const dayDate = _getDayDate(data.dt);
      const dayTemp = _formatTemp(data.main.temp);
      const dayDesc = _upperFirst(data.weather[0].description);

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

  return Object.freeze({ formatCurrentData, formatForecastData });
})();


/* CONTROLLER - data flow: getLocation => getData => formatData => printData */
const mainCtrl = (async (DOM, DATA, AUX) => {
  const { els, templates, errorAlert, printer } = DOM;
  const { getLocation, prepRequestUrls, getWeatherData } = DATA;
  const { formatCurrentData, formatForecastData } = AUX;

  // get location from browser (on resolve) or fetch() IP address (on reject)
  const coordinates = await getLocation(errorAlert)
    .catch(ipLocate => ipLocate.then(res => res.json()).catch(errorAlert));

  // get, prep & print weather data - hide 'loading spinner' before printing
  const getWeather = async (coords) => {
    const requestUrls = prepRequestUrls(coords);
    try {
      const weatherData = await getWeatherData(requestUrls, errorAlert);
      const { current, forecast } = weatherData;
      const currentFormatted = formatCurrentData(current);
      const forecastsFormatted = formatForecastData(forecast);
      const currentTemplate = templates.current(currentFormatted);
      const forecastTemplate = templates.forecast(forecastsFormatted);
      els.loadingSpinner.style.display = 'none';
      printer(currentTemplate, els.sectionCurr);
      printer(forecastTemplate, els.sectionFore);
    }
    catch (err) {
      return errorAlert();
    }
  };

  // INITIATES PROGRAM
  getWeather(coordinates);
})(DOM, DATA, AUX);
