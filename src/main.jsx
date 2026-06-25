import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./styles.css";

const appLogoUrl = new URL("../Images/elakelogo.webp", import.meta.url).href;

const storageKeys = {
  sources: "event-calendar:sources",
  events: "event-calendar:events",
};

const lahtiEventsSource = {
  id: "lahti-events",
  name: "Lahden tapahtumakalenteri",
  url: "/lahti-api/collection/67d2d42c81de245f55fe382f/content?lang=fi&country=FI&limit=120&mode=event&sort=startDate&age_id=age-7",
  type: "eventz",
  markAllAsSenior: true,
};

const elakeliittoSource = {
  id: "elakeliitto-paijat-hame",
  name: "Eläkeliitto Päijät-Häme",
  url: "/elakeliitto/tapahtumat/",
  type: "elakeliitto",
};

const defaultSources = [lahtiEventsSource, elakeliittoSource];

const monthFormatter = new Intl.DateTimeFormat("fi-FI", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("fi-FI", { weekday: "long", day: "numeric", month: "long" });
const today = startOfDay(new Date());
const seniorKeywords = [
  "seniori",
  "seniorit",
  "seniorien",
  "senioripiste",
  "vanhus",
  "vanhukset",
  "vanhusten",
  "ikääntynyt",
  "ikääntyneet",
  "ikääntyneiden",
  "ikäihminen",
  "ikäihmiset",
  "eläkeläinen",
  "eläkeläiset",
  "eläkeläisten",
  "seniors",
];

function App() {
  const [sources, setSources] = useStoredState(storageKeys.sources, defaultSources);
  const [events, setEvents] = useStoredState(storageKeys.events, []);
  const [visibleMonth, setVisibleMonth] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [syncStatus, setSyncStatus] = React.useState("Lahden tapahtumat haetaan Viten proxylla. Paina Päivitä lähteet.");
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [view, setView] = React.useState("home");

  React.useEffect(() => {
    setSources((items) => {
      const defaultsById = new Map(defaultSources.map((source) => [source.id, source]));
      const updatedSources = items.map((source) => defaultsById.get(source.id) ?? source);
      const existingIds = new Set(updatedSources.map((source) => source.id));
      const missingDefaults = defaultSources.filter((source) => !existingIds.has(source.id));
      return [...missingDefaults, ...updatedSources];
    });
  }, [setSources]);

  const selectedDateKey = toISODate(selectedDate);
  const selectedEvents = events
    .filter((item) => item.date === selectedDateKey)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  const eventDotsByDate = events.reduce((dots, item) => {
    dots[item.date] ??= new Set();
    if (item.sourceType === "elakeliitto") {
      dots[item.date].add("dot dot-elakeliitto");
    } else if (item.isSeniorEvent) {
      dots[item.date].add("dot dot-senior");
    } else {
      dots[item.date].add("dot");
    }
    return dots;
  }, {});

  function selectDate(date) {
    setSelectedDate(date);
    if (date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function addSource(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSources((items) => [
      {
        id: createId(),
        name: form.get("sourceName").trim(),
        url: form.get("sourceUrl").trim(),
        type: form.get("sourceType"),
      },
      ...items,
    ]);
    event.currentTarget.reset();
  }

  function addEvent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = form.get("eventDate");
    setEvents((items) => [
      ...items,
      {
        id: createId(),
        title: form.get("eventTitle").trim(),
        date,
        time: form.get("eventTime"),
        place: form.get("eventPlace").trim(),
        source: "Käsin lisätty",
      },
    ]);
    const parsedDate = parseISODate(date);
    setSelectedDate(parsedDate);
    setVisibleMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
    event.currentTarget.reset();
  }

  async function syncSources() {
    setIsSyncing(true);
    setSyncStatus("Päivitetään lähteitä...");
    const results = await Promise.allSettled(sources.map((source) => importSource(source)));
    const imported = results.reduce((sum, result) => sum + (result.value?.length ?? 0), 0);
    const failed = results.filter((result) => result.status === "rejected").length;
    const newEvents = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    setEvents((items) => mergeEvents(items, newEvents));
    setSyncStatus(
      failed > 0
        ? `${imported} tapahtumaa lisätty. ${failed} lähdettä vaatii todennäköisesti backendin tai CORS-välityksen.`
        : `${imported} tapahtumaa lisätty lähteistä.`,
    );
    setIsSyncing(false);
  }

  if (view === "home") {
    return <HomeScreen onOpenCalendar={() => setView("calendar")} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Tapahtumalähteet">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">K</div>
          <div>
            <p className="eyebrow">Keräävä kalenteri</p>
            <h1>Tapahtumat</h1>
          </div>
        </div>

        <section className="panel">
          <div className="section-heading">
            <h2>Lähteet</h2>
            <span className="count">{sources.length}</span>
          </div>
          <form className="stack" onSubmit={addSource}>
            <label>
              Nimi
              <input name="sourceName" type="text" placeholder="Kaupunki, seura, venue..." required />
            </label>
            <label>
              Osoite
              <input name="sourceUrl" type="url" placeholder="https://..." required />
            </label>
            <label>
              Tyyppi
              <select name="sourceType">
                <option value="rss">RSS / Atom</option>
                <option value="ics">ICS-kalenteri</option>
                <option value="eventz">Eventz / Townbase JSON</option>
                <option value="elakeliitto">Eläkeliitto HTML</option>
                <option value="html">Verkkosivu</option>
              </select>
            </label>
            <button type="submit" className="primary-btn">Lisää lähde</button>
          </form>
          <button type="button" className="secondary-btn wide-btn" disabled={isSyncing} onClick={syncSources}>
            Päivitä lähteet
          </button>
          <p className="status-text">{syncStatus}</p>
          <div className="source-list">
            {sources.length === 0 ? <p className="empty">Ei lähteitä vielä.</p> : null}
            {sources.map((source) => (
              <article className="source-item" key={source.id}>
                <div className="item-row">
                  <div>
                    <p className="item-title">{source.name}</p>
                    <p className="item-meta">{source.url}</p>
                  </div>
                  <span className="tag">{source.type}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Kuukausinäkymä</p>
            <h2>{capitalize(monthFormatter.format(visibleMonth))}</h2>
          </div>
          <div className="toolbar" aria-label="Kalenterin ohjaimet">
            <button type="button" className="secondary-btn" onClick={() => setView("home")}>
              Etusivu
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Edellinen kuukausi"
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <ChevronLeft size={22} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setSelectedDate(today);
                setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              }}
            >
              Tänään
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Seuraava kuukausi"
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <ChevronRight size={22} strokeWidth={2.4} />
            </button>
          </div>
        </header>

        <section className="calendar-wrap" aria-label="Kuukausikalenteri">
          <div className="weekday-row" aria-hidden="true">
            <span>Ma</span>
            <span>Ti</span>
            <span>Ke</span>
            <span>To</span>
            <span>Pe</span>
            <span>La</span>
            <span>Su</span>
          </div>
          <div className="calendar-grid">
            {getCalendarDates(visibleMonth).map((date) => {
              const dateKey = toISODate(date);
              const dots = [...(eventDotsByDate[dateKey] ?? [])];
              return (
                <button
                  type="button"
                  key={dateKey}
                  aria-label={dayFormatter.format(date)}
                  className={[
                    "day",
                    date.getMonth() !== visibleMonth.getMonth() ? "is-outside" : "",
                    isSameDay(date, today) ? "is-today" : "",
                    isSameDay(date, selectedDate) ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectDate(date)}
                >
                  <span className="day-number">{date.getDate()}</span>
                  <span className="event-dots">
                    {dots.map((className) => (
                      <span className={className} key={className} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bottom-grid">
          <article className="panel">
            <div className="section-heading">
              <h2>{capitalize(dayFormatter.format(selectedDate))}</h2>
              <span className="count">{selectedEvents.length}</span>
            </div>
            <div className="event-list">
              {selectedEvents.length === 0 ? <p className="empty">Ei tapahtumia tälle päivälle.</p> : null}
              {selectedEvents.map((item) => (
                <article className={getEventItemClass(item)} key={item.id}>
                  <div className="item-row">
                    <div>
                      <p className="item-title">{item.title}</p>
                      <p className="item-meta">{[item.time, item.place].filter(Boolean).join(" · ") || "Aika avoin"}</p>
                    </div>
                    <span className={getEventTagClass(item)}>{getEventTagText(item)}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-heading">
              <h2>Lisää tapahtuma</h2>
            </div>
            <form className="event-form" onSubmit={addEvent}>
              <label>
                Otsikko
                <input name="eventTitle" type="text" placeholder="Tapahtuman nimi" required />
              </label>
              <label>
                Päivä
                <input name="eventDate" type="date" defaultValue={selectedDateKey} required />
              </label>
              <label>
                Aika
                <input name="eventTime" type="time" />
              </label>
              <label>
                Paikka
                <input name="eventPlace" type="text" placeholder="Sijainti" />
              </label>
              <button type="submit" className="primary-btn">Tallenna tapahtuma</button>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}

function HomeScreen({ onOpenCalendar }) {
  return (
    <main className="home-screen">
      <section className="home-hero" aria-label="Etusivu">
        <img className="home-logo" src={appLogoUrl} alt="Sovelluksen logo" />
        <div className="home-copy">
          <p className="eyebrow">Eläkeläisten tapahtumat</p>
          <h1>Löydä Lahden menot helposti</h1>
        </div>
        <div className="home-actions" aria-label="Päävalikko">
          <button type="button" className="primary-btn home-action" onClick={onOpenCalendar}>
            Kalenteriin
          </button>
          <button type="button" className="secondary-btn home-action" disabled>
            Muistutukset
          </button>
          <button type="button" className="secondary-btn home-action" disabled>
            Suosikit
          </button>
        </div>
      </section>
    </main>
  );
}

function getEventItemClass(event) {
  if (event.sourceType === "elakeliitto") {
    return "event-item elakeliitto-event";
  }
  return event.isSeniorEvent ? "event-item senior-event" : "event-item";
}

function getEventTagClass(event) {
  if (event.sourceType === "elakeliitto") {
    return "tag tag-elakeliitto";
  }
  return event.isSeniorEvent ? "tag tag-senior" : "tag";
}

function getEventTagText(event) {
  if (event.sourceType === "elakeliitto") {
    return "Eläkeliitto";
  }
  return event.isSeniorEvent ? "Seniorit" : event.source;
}

function useStoredState(key, fallback) {
  const [value, setValue] = React.useState(() => load(key, fallback));
  React.useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue];
}

async function importSource(source) {
  if (source.type === "html") {
    throw new Error("HTML scraping requires backend");
  }
  if (source.type === "elakeliitto") {
    return importElakeliittoEvents(source);
  }
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Source returned ${response.status}`);
  }
  const text = await response.text();
  if (source.type === "eventz") {
    return parseEventz(JSON.parse(text), source.name, source.markAllAsSenior);
  }
  return source.type === "ics" ? parseICS(text, source.name) : parseRSS(text, source.name);
}

async function importElakeliittoEvents(source) {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Source returned ${response.status}`);
  }

  const html = await response.text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const links = [...document.querySelectorAll('a[href*="/tapahtumat/"]')]
    .map((link) => link.href.replace("https://paijat-hame.elakeliitto.fi", "/elakeliitto"))
    .filter((href) => /\/tapahtumat\/.+\/$/.test(href) && href !== source.url);
  const uniqueLinks = [...new Set(links)].slice(0, 20);
  const pages = await Promise.all(uniqueLinks.map((url) => fetchElakeliittoEvent(url, source.name)));
  return pages.filter(Boolean);
}

async function fetchElakeliittoEvent(url, sourceName) {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const title = readDOMText(document, ".event-hero__title") || readDOMText(document, "h1");
  const infoValues = [...document.querySelectorAll(".event-hero__info-value")].map((node) => node.textContent.trim());
  const dateText = infoValues.find((value) => /\d{1,2}\.\d{1,2}\.\d{4}/.test(value)) ?? "";
  const place = infoValues.find((value) => value !== dateText) ?? "";
  const start = parseFinnishEventDate(dateText);

  if (!title || !start) {
    return null;
  }

  return {
    id: `elakeliitto-${url}`,
    title,
    date: toISODate(start),
    time: toTime(start),
    place,
    source: sourceName,
    sourceType: "elakeliitto",
    isSeniorEvent: true,
    url: url.replace("/elakeliitto", "https://paijat-hame.elakeliitto.fi"),
    description: readDOMText(document, ".event-content, .entry-content, main"),
  };
}

function parseEventz(data, sourceName, markAllAsSenior = false) {
  return (data.pages ?? []).flatMap((page) => {
    const dates = page.event?.dates?.length ? page.event.dates : [{ start: page.defaultStartDate, end: page.defaultEndDate }];
    return dates
      .map((dateItem) => {
        const start = dateItem.start ? new Date(dateItem.start) : null;
        if (!page.name || !start || Number.isNaN(start.getTime())) {
          return null;
        }

        return {
          id: `${page._id}-${dateItem.start}`,
          title: page.name,
          date: toISODate(start),
          time: toTime(start),
          place: page.locations?.[0]?.address ?? "",
          source: sourceName,
          url: page.originalUrl ?? "",
          description: stripHTML(page.descriptionShort ?? page.descriptionLong ?? ""),
          isSeniorEvent: markAllAsSenior || isSeniorRelevant(page),
        };
      })
      .filter(Boolean);
  });
}

function isSeniorRelevant(page) {
  const haystack = [
    page.name,
    page.descriptionShort,
    page.descriptionLong,
    page.ownerName,
    ...(page.hashtags ?? []),
    ...(page.globalContentCategories ?? []),
    ...(page.locations ?? []).map((location) => location.address),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("fi-FI");

  return seniorKeywords.some((keyword) => haystack.includes(keyword));
}

function parseRSS(text, sourceName) {
  const document = new DOMParser().parseFromString(text, "text/xml");
  return [...document.querySelectorAll("item, entry")]
    .map((item) => {
      const title = readText(item, "title");
      const dateText = readText(item, "start, published, updated, pubDate");
      const date = dateText ? new Date(dateText) : null;
      if (!title || !date || Number.isNaN(date.getTime())) {
        return null;
      }
      return {
        id: createId(),
        title,
        date: toISODate(date),
        time: dateHasTime(dateText) ? toTime(date) : "",
        place: readText(item, "location, venue"),
        source: sourceName,
      };
    })
    .filter(Boolean);
}

function parseICS(text, sourceName) {
  return text
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((block) => {
      const title = readICSField(block, "SUMMARY");
      const start = readICSField(block, "DTSTART");
      const date = parseICSDate(start);
      if (!title || !date) {
        return null;
      }
      return {
        id: createId(),
        title,
        date: toISODate(date),
        time: start.includes("T") ? toTime(date) : "",
        place: readICSField(block, "LOCATION"),
        source: sourceName,
      };
    })
    .filter(Boolean);
}

function mergeEvents(currentEvents, newEvents) {
  const mergedByKey = new Map(currentEvents.map((event) => [eventKey(event), event]));

  for (const event of newEvents) {
    const key = eventKey(event);
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, existing ? { ...existing, ...event, isSeniorEvent: existing.isSeniorEvent || event.isSeniorEvent } : event);
  }

  return [...mergedByKey.values()];
}

function eventKey(event) {
  return [event.title, event.date, event.time, event.place, event.source].join("|").toLowerCase();
}

function readText(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() ?? "";
}

function readICSField(block, field) {
  const line = block.split(/\r?\n/).find((candidate) => candidate.startsWith(`${field}:`) || candidate.startsWith(`${field};`));
  return line ? line.slice(line.indexOf(":") + 1).replace(/\\,/g, ",").trim() : "";
}

function parseICSDate(value) {
  const match = value?.replace("Z", "").match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour = "00", minute = "00"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function getCalendarDates(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function load(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return toISODate(a) === toISODate(b);
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateHasTime(value) {
  return /T|\d{1,2}:\d{2}/.test(value);
}

function readDOMText(document, selector) {
  return document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function parseFinnishEventDate(value) {
  const match = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+klo\s+(\d{1,2})[:.](\d{2}))?/i);
  if (!match) {
    return null;
  }

  const [, day, month, year, hour = "00", minute = "00"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function stripHTML(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
