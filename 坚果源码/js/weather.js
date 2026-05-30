/**
 * 坚果 - 天气模块
 * 使用 Open-Meteo API（免费、无需密钥）获取天气信息
 * 默认位置：绵阳（纬度 31.46，经度 104.68）
 */
const WeatherModule = {
  state: {
    current: null,
    forecast: [],
    loading: false,
    error: null,
    lastUpdate: null,
    updateTimer: null,
    cachedData: null  // 离线缓存
  },

  // Open-Meteo WMO 天气代码 → 中文描述 + 图标
  weatherMap: {
    0:  { desc: '晴天', icon: '☀️' },
    1:  { desc: '少云', icon: '🌤️' },
    2:  { desc: '多云', icon: '⛅' },
    3:  { desc: '阴天', icon: '☁️' },
    45: { desc: '雾', icon: '🌫️' },
    48: { desc: '雾凇', icon: '🌫️' },
    51: { desc: '小毛毛雨', icon: '🌧️' },
    53: { desc: '毛毛雨', icon: '🌧️' },
    55: { desc: '大毛毛雨', icon: '🌧️' },
    56: { desc: '冻毛毛雨', icon: '🌨️' },
    57: { desc: '大冻毛毛雨', icon: '🌨️' },
    61: { desc: '小雨', icon: '🌧️' },
    63: { desc: '中雨', icon: '🌧️' },
    65: { desc: '大雨', icon: '🌧️' },
    66: { desc: '冻雨', icon: '🌨️' },
    67: { desc: '大冻雨', icon: '🌨️' },
    71: { desc: '小雪', icon: '🌨️' },
    73: { desc: '中雪', icon: '❄️' },
    75: { desc: '大雪', icon: '❄️' },
    77: { desc: '雪粒', icon: '🌨️' },
    80: { desc: '阵雨', icon: '🌦️' },
    81: { desc: '中阵雨', icon: '🌦️' },
    82: { desc: '大阵雨', icon: '🌦️' },
    85: { desc: '小阵雪', icon: '🌨️' },
    86: { desc: '大阵雪', icon: '🌨️' },
    95: { desc: '雷暴', icon: '⛈️' },
    96: { desc: '雷暴+冰雹', icon: '⛈️' },
    99: { desc: '强雷暴+冰雹', icon: '⛈️' }
  },

  getWeatherInfo(code) {
    return this.weatherMap[code] || { desc: '未知', icon: '🌤️' };
  },

  async render(area) {
    const lat = App.state.settings.weatherLat || 31.46;
    const lon = App.state.settings.weatherLon || 104.68;
    const cityName = App.state.settings.weatherCity || '绵阳';
    const enabled = App.state.settings.weatherEnabled !== false;

    area.innerHTML = `
      <div class="weather-module">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0;">天气预报</h2>
            <p style="font-size:12px;color:var(--text-tertiary);margin:4px 0 0;">
              数据来源：Open-Meteo（免费开放） · ${cityName}
              ${this.state.lastUpdate ? ' · 更新于 ' + App.formatDate(this.state.lastUpdate) : ''}
            </p>
          </div>
          <button class="btn btn-primary" onclick="WeatherModule.fetchWeather()">更新天气</button>
        </div>

        ${!enabled ? `
          <div class="card"><div class="empty-state">
            <i>☀️</i>
            <div class="empty-state-title">天气功能已禁用</div>
            <div class="empty-state-desc">请在设置中启用天气功能</div>
            <button class="btn btn-primary mt-3" onclick="App.navigateTo('settings')">前往设置</button>
          </div></div>
        ` : this.state.error ? `
          <div class="card"><div class="empty-state">
            <i>⚠️</i>
            <div class="empty-state-title">获取天气失败</div>
            <div class="empty-state-desc">${this.state.error}</div>
            <button class="btn btn-primary mt-3" onclick="WeatherModule.fetchWeather()">重试</button>
          </div></div>
        ` : this.state.current ? this.renderWeatherData() : this.state.loading ? `
          <div class="card"><div class="empty-state"><div class="empty-state-desc">正在加载天气数据...</div></div></div>
        ` : `
          <div class="card"><div class="empty-state">
            <i>☀️</i>
            <div class="empty-state-title">点击"更新天气"获取天气信息</div>
            <div class="empty-state-desc">使用 Open-Meteo 免费天气服务，无需 API 密钥</div>
          </div></div>
        `}
      </div>`;
  },

  renderWeatherData() {
    const w = this.state.current;
    const wi = this.getWeatherInfo(w.weatherCode);

    const isOffline = this.state._isOffline;
    const offlineHint = isOffline ? '<div style="font-size:11px;color:#f59e0b;margin-top:4px;">⚠️ 网络异常，显示的是缓存数据</div>' : '';

    return `
      ${offlineHint}
      <div class="weather-card">
        <div class="weather-main">
          <div style="font-size:64px;">${wi.icon}</div>
          <div>
            <div class="weather-temp">${w.temperature}°C</div>
            <div class="weather-desc">${wi.desc} | 体感 ${w.apparentTemp}°C</div>
            <div style="font-size:14px;margin-top:4px;">${App.state.settings.weatherCity || '绵阳'}</div>
          </div>
        </div>
        <div class="weather-details">
          <div class="weather-detail-item">
            <div>湿度</div>
            <div class="weather-detail-value">${w.humidity}%</div>
          </div>
          <div class="weather-detail-item">
            <div>风速</div>
            <div class="weather-detail-value">${w.windSpeed} km/h</div>
          </div>
          <div class="weather-detail-item">
            <div>体感温度</div>
            <div class="weather-detail-value">${w.apparentTemp}°C</div>
          </div>
        </div>
      </div>

      ${this.state.forecast.length > 0 ? `
        <h3 style="font-size:16px;font-weight:600;margin:20px 0 12px;">未来天气预报</h3>
        <div class="forecast-list">
          ${this.state.forecast.map(f => {
            const fi = this.getWeatherInfo(f.weatherCode);
            return `
              <div class="forecast-item">
                <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px;">${f.date} ${f.weekday}</div>
                <div style="font-size:28px;">${fi.icon}</div>
                <div style="font-size:14px;font-weight:700;">${f.tempMax}° / ${f.tempMin}°</div>
                <div style="font-size:11px;color:var(--text-secondary);">${fi.desc}</div>
                ${f.precipProb !== undefined ? `<div style="font-size:10px;color:var(--info);">降水概率 ${f.precipProb}%</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      ` : ''}
    `;
  },

  async fetchWeather() {
    this.state.loading = true;
    this.state.error = null;
    this.state._isOffline = false;
    this.render(document.getElementById('contentArea'));

    const lat = App.state.settings.weatherLat || 31.46;
    const lon = App.state.settings.weatherLon || 104.68;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Shanghai&forecast_days=4`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`请求失败 (${resp.status})`);

      const data = await resp.json();

      // 解析当前天气
      this.state.current = {
        temperature: Math.round(data.current.temperature_2m),
        humidity: data.current.relative_humidity_2m,
        apparentTemp: Math.round(data.current.apparent_temperature),
        weatherCode: data.current.weather_code,
        windSpeed: data.current.wind_speed_10m
      };

      // 解析未来天气预报（跳过今天，取未来3天）
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      this.state.forecast = [];
      for (let i = 1; i <= 3; i++) {
        if (i < data.daily.time.length) {
          const d = new Date(data.daily.time[i]);
          this.state.forecast.push({
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            weekday: weekDays[d.getDay()],
            weatherCode: data.daily.weather_code[i],
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            precipProb: data.daily.precipitation_probability_max[i]
          });
        }
      }

      this.state.lastUpdate = new Date().toISOString();

      // 缓存数据用于离线使用
      this.state.cachedData = {
        current: { ...this.state.current },
        forecast: [...this.state.forecast],
        lastUpdate: this.state.lastUpdate
      };

    } catch (e) {
      console.error('获取天气失败:', e.message);

      // 离线降级：使用缓存数据
      if (this.state.cachedData) {
        this.state.current = this.state.cachedData.current;
        this.state.forecast = this.state.cachedData.forecast;
        this.state.lastUpdate = this.state.cachedData.lastUpdate;
        this.state._isOffline = true;
      } else {
        this.state.error = e.message === 'Failed to fetch'
          ? '网络连接失败，请检查网络后重试'
          : e.message;
      }
    }

    this.state.loading = false;
    this.render(document.getElementById('contentArea'));
    this.updateMiniWeather();
  },

  updateMiniWeather() {
    const w = this.state.current;
    const icon = document.getElementById('weatherMiniIcon');
    const text = document.getElementById('weatherMiniText');
    if (icon && text && w) {
      const wi = this.getWeatherInfo(w.weatherCode);
      icon.textContent = wi.icon;
      text.textContent = `${w.temperature}°C ${App.state.settings.weatherCity || '绵阳'}`;
    }
  },

  startAutoUpdate() {
    if (this.state.updateTimer) clearInterval(this.state.updateTimer);
    const interval = (App.state.settings.weatherUpdateInterval || 30) * 60000;
    this.state.updateTimer = setInterval(() => {
      if (App.state.settings.weatherEnabled !== false) {
        this.fetchWeather();
      }
    }, interval);
  }
};
