import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney, formatDate } from "@/lib/format";
import type { GivingStats } from "@/lib/data/stats";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#3d3128" },
  header: { marginBottom: 24 },
  brand: { fontSize: 11, color: "#a34c26", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: "#6b5d51", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  stat: {
    flex: 1,
    backgroundColor: "#faf6ef",
    borderRadius: 8,
    padding: 12,
  },
  statLabel: { fontSize: 8, color: "#96897b", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 16 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e9dfd0",
    paddingVertical: 5,
  },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#3d3128",
    paddingVertical: 5,
  },
  headCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#96897b", textTransform: "uppercase" },
  totalRow: { flexDirection: "row", paddingVertical: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#96897b",
    textAlign: "center",
  },
});

export interface ReportCase {
  date: string;
  animal: string;
  owner: string;
  situation: string;
  amount: number | null;
}

export function GivingReportDocument({
  year,
  stats,
  cases,
}: {
  year: number;
  stats: GivingStats;
  cases: ReportCase[];
}) {
  return (
    <Document title={`Rowley Family Giving Report ${year}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>ROWLEY FAMILY CHARITABLE GIVING TRUST</Text>
          <Text style={styles.title}>{year} Animal Rescue Giving Report</Text>
          <Text style={styles.subtitle}>
            Veterinary care funded for rescue animals referred by PACC 911 · generated {formatDate(new Date().toISOString())}
          </Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total given in {year}</Text>
            <Text style={styles.statValue}>{formatMoney(stats.yearTotal)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Animals helped</Text>
            <Text style={styles.statValue}>{String(stats.yearCases)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Average per case</Text>
            <Text style={styles.statValue}>{formatMoney(stats.avgPerCase)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>By month</Text>
        <View style={styles.headRow}>
          <Text style={[styles.headCell, { flex: 2 }]}>Month</Text>
          <Text style={[styles.headCell, { flex: 1, textAlign: "right" }]}>Cases</Text>
          <Text style={[styles.headCell, { flex: 1, textAlign: "right" }]}>Given</Text>
        </View>
        {stats.monthlyTotals.map((m) => (
          <View key={m.month} style={styles.row}>
            <Text style={{ flex: 2 }}>
              {new Date(m.month + "-15").toLocaleDateString("en-US", { month: "long" })}
            </Text>
            <Text style={{ flex: 1, textAlign: "right" }}>{String(m.count)}</Text>
            <Text style={{ flex: 1, textAlign: "right" }}>{formatMoney(m.total)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={[styles.bold, { flex: 2 }]}>Total</Text>
          <Text style={[styles.bold, { flex: 1, textAlign: "right" }]}>{String(stats.yearCases)}</Text>
          <Text style={[styles.bold, { flex: 1, textAlign: "right" }]}>{formatMoney(stats.yearTotal)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Cases</Text>
        <View style={styles.headRow}>
          <Text style={[styles.headCell, { flex: 1.2 }]}>Date</Text>
          <Text style={[styles.headCell, { flex: 1.5 }]}>Animal</Text>
          <Text style={[styles.headCell, { flex: 1.8 }]}>Owner</Text>
          <Text style={[styles.headCell, { flex: 3.5 }]}>Care provided</Text>
          <Text style={[styles.headCell, { flex: 1, textAlign: "right" }]}>Amount</Text>
        </View>
        {cases.map((c, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={{ flex: 1.2 }}>{c.date}</Text>
            <Text style={{ flex: 1.5 }}>{c.animal}</Text>
            <Text style={{ flex: 1.8 }}>{c.owner}</Text>
            <Text style={{ flex: 3.5 }}>{c.situation}</Text>
            <Text style={{ flex: 1, textAlign: "right" }}>{formatMoney(c.amount)}</Text>
          </View>
        ))}
        {cases.length === 0 && (
          <View style={styles.row}>
            <Text>No completed cases yet this year.</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Prepared with Biscuit — the Rowley Family giving tracker
        </Text>
      </Page>
    </Document>
  );
}
