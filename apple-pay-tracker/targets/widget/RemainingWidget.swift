import SwiftUI
import WidgetKit

// MARK: - Dati scritti dall'app

/// Il semicerchio della Home come lo scrive `lib/widget.ts`.
struct Gauge: Decodable {
  let month: String
  let limit: Double
  let binding: Double
  let spent: Double
  /// Speso oggi. Manca se l'app installata e' di prima che lo scrivesse.
  let today: Double?
  let synthetic: Bool
  let updatedAt: Double

  var remaining: Double { binding - spent }
  var updated: Date { Date(timeIntervalSince1970: updatedAt / 1000) }

  static let appGroup = "group.com.andreadecaro.clinck"

  static func load() -> Gauge? {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: "gauge") else { return nil }
    return try? JSONDecoder().decode(Gauge.self, from: data)
  }

  /// Solo per l'anteprima nella galleria dei widget.
  static let sample = Gauge(month: monthKey(Date()), limit: 1200, binding: 1200, spent: 788, today: 12.4,
                            synthetic: false, updatedAt: Date().timeIntervalSince1970 * 1000)

  static func monthKey(_ date: Date) -> String {
    let c = Calendar.current.dateComponents([.year, .month], from: date)
    return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
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

  /// Con i centesimi sotto i 100 €: "12,40 €" dice di piu' di "12 €".
  static func exact(_ value: Double) -> String {
    let f = value < 100 ? cents : whole
    return (f.string(from: NSNumber(value: value)) ?? "\(value)") + " €"
  }
}

struct Stat: View {
  let label: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(label).font(.system(size: 8.5)).foregroundStyle(Color("ink2"))
      Text(value)
        .font(.system(size: 13.5, weight: .semibold))
        .foregroundStyle(Color("ink"))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }
}

struct RemainingView: View {
  let entry: Entry

  var body: some View {
    Group {
      if let gauge = entry.gauge, gauge.month == Gauge.monthKey(entry.date) {
        content(gauge)
          .padding(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14))
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

  private var monthName: String {
    entry.date.formatted(Date.FormatStyle(locale: Locale(identifier: "it_IT")).month(.wide))
  }

  private func content(_ gauge: Gauge) -> some View {
    let over = gauge.remaining < 0
    // Arco e testo sul vincolo, non sul fondo scala della Home: con limite e
    // obiettivo insieme i due differiscono, e "oltre di 397 € · di 1.350 €"
    // si legge come un conto sbagliato.
    let ratio = gauge.binding > 0 ? min(max(gauge.spent / gauge.binding, 0), 1) : 1
    let updatedToday = calendar.isDate(gauge.updated, inSameDayAs: entry.date)
    // Il ritmo: dove saresti a fine giornata spendendo lo stesso ogni giorno.
    let daysInMonth = Double(calendar.range(of: .day, in: .month, for: entry.date)?.count ?? 30)
    let pace = Double(calendar.component(.day, from: entry.date)) / daysInMonth
    let paceGap = gauge.spent - gauge.binding * pace
    return VStack(spacing: 5) {
      HStack(alignment: .firstTextBaseline) {
        Title()
        Spacer()
        Text(corner(gauge))
          .font(.system(size: 9))
          .foregroundStyle(Color("ink2"))
          .lineLimit(1)
      }
      ZStack(alignment: .bottom) {
        HalfArc(lineWidth: 12)
          .stroke(Color("track"), style: StrokeStyle(lineWidth: 12, lineCap: .round))
        HalfArc(lineWidth: 12)
          .trim(from: 0, to: over ? 1 : ratio)
          .stroke(over ? Color("over") : Color("$accent"),
                  style: StrokeStyle(lineWidth: 12, lineCap: .round))
        if !over {
          ArcTick(at: pace, lineWidth: 12)
            .stroke(Color("ink"), style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
        VStack(spacing: -2) {
          Text(over ? "oltre di" : "restano")
            .font(.system(size: 9))
            .foregroundStyle(over ? Color("over") : Color("ink2"))
          Text(Money.text(abs(gauge.remaining), roundingUp: over))
            .font(.system(size: 29, weight: .semibold))
            .tracking(-0.9)
            .foregroundStyle(over ? Color("over") : Color("ink"))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.horizontal, 16)
        }
      }
      .frame(width: 136, height: 68)
      .frame(maxWidth: .infinity)
      .padding(.top, 2)

      Group {
        if over {
          Text("oltre il limite di \(Money.text(gauge.binding))")
            .foregroundStyle(Color("over"))
        } else if paceGap >= 0 {
          Text("\(Money.text(paceGap, roundingUp: true)) sopra il ritmo")
            .foregroundStyle(Color("over"))
        } else {
          Text("\(Money.text(-paceGap)) sotto il ritmo")
            .foregroundStyle(Color("ink2"))
        }
      }
      .font(.system(size: 9, weight: .medium))
      .lineLimit(1)
      .minimumScaleFactor(0.8)

      Spacer(minLength: 0)
      Rectangle().fill(Color("track")).frame(height: 1)

      HStack(alignment: .top) {
        // Oltre il limite non c'e' piu' niente da dividere: al suo posto
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
        Stat(label: "Giorni", value: "\(daysLeft)")
      }
      .padding(.top, 1)
    }
  }

  /// In alto a destra il mese; se i numeri sono vecchi, da quando.
  private func corner(_ gauge: Gauge) -> String {
    guard entry.date.timeIntervalSince(gauge.updated) > staleAfter else { return monthName }
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
      Text("Apri Clinck per vedere quanto resta questo mese")
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
    .configurationDisplayName("Quanto resta")
    .description("Quanto puoi ancora spendere questo mese, come nella Home.")
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
