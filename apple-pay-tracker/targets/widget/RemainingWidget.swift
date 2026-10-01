import SwiftUI
import WidgetKit

// MARK: - Dati scritti dall'app

/// Il semicerchio della Home come lo scrive `lib/widget.ts`.
struct Gauge: Decodable {
  let month: String
  /// Fondo scala della Home (il piu' largo fra limite e obiettivo).
  let limit: Double
  /// Il vincolo su cui si conta quanto resta (il piu' stretto dei due).
  let binding: Double
  let spent: Double
  let synthetic: Bool
  let updatedAt: Double
  // Opzionali: un'app installata prima che li scrivesse non li manda.
  let today: Double?
  let spendLimit: Double?
  let goalLimit: Double?
  let fixed: Double?

  var remaining: Double { binding - spent }
  var updated: Date { Date(timeIntervalSince1970: updatedAt / 1000) }

  static let appGroup = "group.com.andreadecaro.clinck"

  static func load() -> Gauge? {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: "gauge") else { return nil }
    return try? JSONDecoder().decode(Gauge.self, from: data)
  }

  /// Solo per l'anteprima nella galleria dei widget.
  static let sample = Gauge(month: monthKey(Date()), limit: 1350, binding: 1200, spent: 788,
                            synthetic: false, updatedAt: Date().timeIntervalSince1970 * 1000,
                            today: 12.4, spendLimit: 1200, goalLimit: 1350, fixed: 420)

  static func monthKey(_ date: Date) -> String {
    let c = Calendar.current.dateComponents([.year, .month], from: date)
    return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
  }
}

/// I tratti dell'arco, uno dopo l'altro come le fonti nelle Entrate: il
/// primo fino al vincolo piu' stretto, il secondo fino all'altro.
struct Zones {
  let first: Double
  let second: Double?
  let firstName: String?
  let secondName: String?

  var scale: Double { second ?? first }

  init(_ g: Gauge) {
    if g.synthetic {
      (first, second, firstName, secondName) = (g.binding, nil, "guadagnato", nil)
      return
    }
    switch (g.spendLimit, g.goalLimit) {
    case let (limit?, goal?) where limit != goal:
      let limitFirst = limit < goal
      (first, second) = (min(limit, goal), max(limit, goal))
      (firstName, secondName) = limitFirst ? ("limite", "risparmio") : ("risparmio", "limite")
    case let (limit?, _):
      (first, second, firstName, secondName) = (limit, nil, "limite", nil)
    case let (nil, goal?):
      (first, second, firstName, secondName) = (goal, nil, "risparmio", nil)
    default:
      // Dati di un'app di prima: c'e' solo il vincolo, senza nome.
      (first, second, firstName, secondName) = (g.binding, nil, nil, nil)
    }
  }
}

// MARK: - Timeline

struct Entry: TimelineEntry {
  let date: Date
  let gauge: Gauge?
}

/// Oltre questa eta' il widget dice quando ha ricevuto i numeri: una spesa
/// arrivata dalla Shortcut ad app chiusa qui non c'e' ancora.
let staleAfter: TimeInterval = 3 * 60 * 60

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: Date(), gauge: .sample) }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: Date(), gauge: Gauge.load() ?? (context.isPreview ? .sample : nil)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let now = Date()
    let gauge = Gauge.load()
    // Si ridisegna a mezzanotte (i giorni che restano, "oggi", il cambio di
    // mese) e quando i numeri diventano vecchi, per far comparire l'ora.
    var next = Calendar.current.startOfDay(for: now).addingTimeInterval(24 * 60 * 60)
    if let gauge {
      let staleAt = gauge.updated.addingTimeInterval(staleAfter)
      if staleAt > now && staleAt < next { next = staleAt }
    }
    completion(Timeline(entries: [Entry(date: now, gauge: gauge)], policy: .after(next)))
  }
}

// MARK: - Aspetto

/// Il semicerchio: da sinistra a destra passando per l'alto.
struct HalfArc: Shape {
  var lineWidth: CGFloat

  func path(in rect: CGRect) -> Path {
    let radius = min(rect.width / 2, rect.height) - lineWidth / 2
    let center = CGPoint(x: rect.midX, y: rect.maxY - lineWidth / 2)
    var path = Path()
    path.addArc(center: center, radius: radius, startAngle: .degrees(180),
                endAngle: .degrees(360), clockwise: false)
    return path
  }
}

/// Tacca di traverso sull'arco, al punto `at` (0 = inizio, 1 = fine).
struct ArcTick: Shape {
  var at: Double
  var lineWidth: CGFloat

  func path(in rect: CGRect) -> Path {
    let radius = min(rect.width / 2, rect.height) - lineWidth / 2
    let center = CGPoint(x: rect.midX, y: rect.maxY - lineWidth / 2)
    let angle = CGFloat.pi * (1 + CGFloat(at))
    let inner = radius - lineWidth / 2 - 3, outer = radius + lineWidth / 2 + 3
    var path = Path()
    path.move(to: CGPoint(x: center.x + inner * cos(angle), y: center.y + inner * sin(angle)))
    path.addLine(to: CGPoint(x: center.x + outer * cos(angle), y: center.y + outer * sin(angle)))
    return path
  }
}

/// Un tratto dell'arco da `from` a `to` (frazioni del fondo scala).
struct ArcSegment: View {
  let from: Double
  let to: Double
  let color: Color
  let lineWidth: CGFloat

  var body: some View {
    HalfArc(lineWidth: lineWidth)
      .trim(from: from, to: max(to, from))
      .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
      .opacity(to > from ? 1 : 0)
  }
}

/// Il titolo del widget, nell'angolo in alto a sinistra.
struct Title: View {
  var body: some View {
    Text("Spese")
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(Color("ink"))
  }
}

enum Money {
  // Separatori scritti a mano: con la localizzazione italiana iOS non
  // raggruppa i numeri di quattro cifre ("1200"), l'app scrive "1.200".
  private static func formatter(decimals: Int) -> NumberFormatter {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.numberStyle = .decimal
    f.usesGroupingSeparator = true
    f.groupingSize = 3
    f.groupingSeparator = "."
    f.decimalSeparator = ","
    f.minimumFractionDigits = decimals
    f.maximumFractionDigits = decimals
    return f
  }
  private static let whole = formatter(decimals: 0)
  private static let cents = formatter(decimals: 2)

  /// Arrotondato per non promettere piu' di quanto c'e': quanto resta per
  /// difetto, quanto si e' sforato per eccesso.
  static func text(_ value: Double, roundingUp: Bool = false) -> String {
    let rounded = roundingUp ? value.rounded(.up) : value.rounded(.down)
    return (whole.string(from: NSNumber(value: rounded)) ?? "\(Int(rounded))") + " €"
  }

  /// Solo la cifra, senza valuta.
  static func bare(_ value: Double) -> String {
    whole.string(from: NSNumber(value: value.rounded(.down))) ?? "\(Int(value))"
  }

  /// All'euro piu' vicino, per quanto si e' speso.
  static func nearest(_ value: Double) -> String {
    (whole.string(from: NSNumber(value: value.rounded())) ?? "\(Int(value.rounded()))") + " €"
  }

  /// Con i centesimi sotto i 100 €: "12,40 €" dice di piu' di "12 €".
  static func exact(_ value: Double) -> String {
    let f = value < 100 ? cents : whole
    return (f.string(from: NSNumber(value: value)) ?? "\(value)") + " €"
  }
}

struct Stat: View {
  let label: String
  let value: String
  /// Il trattino della tacca accanto all'etichetta: lega il numero al segno sull'arco.
  var tick = false

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 3) {
        if tick {
          RoundedRectangle(cornerRadius: 0.5).fill(Color("ink")).frame(width: 1.5, height: 7)
        }
        Text(label).font(.system(size: 8.5)).foregroundStyle(Color("ink2"))
      }
      Text(value)
        .font(.system(size: 13.5, weight: .semibold))
        .foregroundStyle(Color("ink"))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }
}

struct LegendItem: View {
  let color: Color
  let text: String

  var body: some View {
    HStack(spacing: 3) {
      Circle().fill(color).frame(width: 5, height: 5)
      Text(text).font(.system(size: 8)).foregroundStyle(Color("ink2")).lineLimit(1)
    }
  }
}

struct RemainingView: View {
  let entry: Entry

  var body: some View {
    Group {
      if let gauge = entry.gauge, gauge.month == Gauge.monthKey(entry.date) {
        content(gauge)
          .padding(EdgeInsets(top: 12, leading: 14, bottom: 11, trailing: 14))
      } else {
        empty.padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
      }
    }
    .containerBackground(Color("$widgetBackground"), for: .widget)
    .monospacedDigit()
  }

  private var calendar: Calendar { Calendar.current }

  /// I giorni da oggi a fine mese, oggi compreso: e' su questi che si divide
  /// quanto resta.
  private var daysLeft: Int {
    (calendar.range(of: .day, in: .month, for: entry.date)?.count ?? 30)
      - calendar.component(.day, from: entry.date) + 1
  }

  private func content(_ gauge: Gauge) -> some View {
    let zones = Zones(gauge)
    let scale = zones.scale > 0 ? zones.scale : 1
    let line: CGFloat = 12
    let first = min(zones.first / scale, 1)
    let spent = min(gauge.spent / scale, 1)
    let over = gauge.remaining < 0
    let updatedToday = calendar.isDate(gauge.updated, inSameDayAs: entry.date)
    let warn = Color("warn")

    return VStack(spacing: 4) {
      HStack(alignment: .firstTextBaseline) {
        Title()
        Spacer()
        Text(corner(gauge))
          .font(.system(size: 9))
          .foregroundStyle(Color("ink2"))
          .lineLimit(1)
      }

      VStack(spacing: 1) {
        ZStack(alignment: .bottom) {
          // Il fondo: il secondo tratto e' gia' tinto, cosi' si vede dove
          // finisce il primo vincolo anche prima di arrivarci. Il secondo si
          // disegna prima, e la punta tonda del primo copre la giunzione.
          if zones.second != nil {
            ArcSegment(from: first, to: 1, color: warn.opacity(0.22), lineWidth: line)
          }
          ArcSegment(from: 0, to: zones.second != nil ? first : 1, color: Color("track"), lineWidth: line)
          if zones.second != nil {
            ArcSegment(from: first, to: max(spent, first), color: warn, lineWidth: line)
          }
          ArcSegment(from: 0, to: min(spent, first),
                     color: zones.second == nil && over ? Color("over") : Color("$accent"),
                     lineWidth: line)
          if let fixed = gauge.fixed, fixed > 0 {
            ArcTick(at: min(fixed / scale, 1), lineWidth: line)
              .stroke(Color("ink"), style: StrokeStyle(lineWidth: 2, lineCap: .round))
          }
          VStack(spacing: -1) {
            Text(Money.nearest(gauge.spent))
              .font(.system(size: 26, weight: .semibold))
              .tracking(-0.8)
              .foregroundStyle(Color("ink"))
              .lineLimit(1)
              .minimumScaleFactor(0.6)
              .padding(.horizontal, 16)
            Text(status(gauge, zones: zones))
              .font(.system(size: 8.5, weight: .medium))
              .foregroundStyle(over ? Color("over") : Color("good"))
              .lineLimit(1)
              .minimumScaleFactor(0.8)
          }
        }
        .frame(width: 136, height: 68)

        // Lo zero e il fondo scala alle due punte dell'arco.
        HStack {
          Text("0")
          Spacer()
          Text(Money.text(zones.scale))
        }
        .font(.system(size: 8))
        .foregroundStyle(Color("ink2"))
        .frame(width: 136)
      }
      .frame(maxWidth: .infinity)

      if let firstName = zones.firstName {
        // Senza "€": in un widget piccolo due cifre con la valuta non ci
        // stanno affiancate, e il fondo scala con la valuta e' gia' sotto l'arco.
        HStack(spacing: 7) {
          LegendItem(color: Color("$accent"), text: "\(firstName) \(Money.bare(zones.first))")
          if let second = zones.second, let secondName = zones.secondName {
            LegendItem(color: warn, text: "\(secondName) \(Money.bare(second))")
          }
        }
        .frame(maxWidth: .infinity)
      }

      Spacer(minLength: 0)
      Rectangle().fill(Color("track")).frame(height: 1)

      HStack(alignment: .top) {
        // Oltre il vincolo non c'e' piu' niente da dividere: al suo posto
        // quanto si e' speso in media ogni giorno finora.
        if over {
          Stat(label: "Media",
               value: Money.text(gauge.spent / Double(calendar.component(.day, from: entry.date))))
        } else {
          Stat(label: "Al giorno", value: Money.text(gauge.remaining / Double(max(daysLeft, 1))))
        }
        Spacer(minLength: 4)
        // "Oggi" letto ieri sarebbe il totale di un altro giorno.
        Stat(label: "Oggi", value: updatedToday ? gauge.today.map(Money.exact) ?? "—" : "—")
        Spacer(minLength: 4)
        Stat(label: "Fissi", value: gauge.fixed.map(Money.nearest) ?? "—", tick: true)
      }
    }
  }

  /// Come la nota sotto il numero in Home: quanto resta o di quanto si e'
  /// sforato il vincolo piu' stretto, e quale dei due e' quando sono due.
  private func status(_ gauge: Gauge, zones: Zones) -> String {
    let amount = gauge.remaining >= 0
      ? "restano \(Money.text(gauge.remaining))"
      : "oltre di \(Money.text(-gauge.remaining, roundingUp: true))"
    guard zones.second != nil, let name = zones.firstName else { return amount }
    return "\(amount) · \(name)"
  }

  /// In alto a destra i giorni che restano; se i numeri sono vecchi, da quando.
  private func corner(_ gauge: Gauge) -> String {
    guard entry.date.timeIntervalSince(gauge.updated) > staleAfter else {
      return daysLeft == 1 ? "ultimo giorno" : "\(daysLeft) giorni"
    }
    if calendar.isDate(gauge.updated, inSameDayAs: entry.date) {
      return "agg. " + gauge.updated.formatted(date: .omitted, time: .shortened)
    }
    if calendar.isDateInYesterday(gauge.updated) { return "agg. ieri" }
    return "agg. "
      + gauge.updated.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "it_IT")))
  }

  private var empty: some View {
    VStack(alignment: .leading, spacing: 6) {
      Title()
      Spacer()
      Text("Apri Clinck per vedere quanto hai speso questo mese")
        .font(.system(size: 13, weight: .medium))
        .foregroundStyle(Color("ink"))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Widget

struct RemainingWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "RemainingWidget", provider: Provider()) { entry in
      RemainingView(entry: entry)
    }
    .configurationDisplayName("Spese del mese")
    .description("Quanto hai speso questo mese contro limite e risparmio, come nella Home.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

@main
struct ClinckWidgets: WidgetBundle {
  var body: some Widget {
    RemainingWidget()
  }
}
