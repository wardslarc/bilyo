import { StyleSheet, Font } from '@react-pdf/renderer';

/**
 * Shared PDF styles for quotations.
 * A4 page size (595.28 x 841.89 pts), consistent branding.
 */

// Brand colours from globals.css, expressed as hex for react-pdf
export const colors = {
  ink: '#131c2b',
  inkDeep: '#0f1724',
  text: '#17202e',
  muted: '#5c6779',
  faint: '#8a93a3',
  line: '#e7e2d9',
  lineSoft: '#ede9e1',
  brass: '#c08a2e',
  brassInk: '#7a5514',
  brassWash: '#f3e7ce',
  jade: '#2e8f86',
  paper: '#fbfaf7',
  white: '#ffffff',
};

// Register a default system font — Helvetica is built into react-pdf
Font.registerHyphenationCallback((word) => [word]);

export const styles = StyleSheet.create({
  // --- Page ---
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.text,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'column',
    maxWidth: '55%',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    maxWidth: '40%',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 8,
    objectFit: 'contain' as const,
  },
  logoPlaceholder: {
    width: 80,
    height: 30,
    marginBottom: 8,
  },
  businessName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 2,
  },
  docTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: colors.brass,
    marginBottom: 4,
  },
  docNumber: {
    fontSize: 10,
    color: colors.muted,
    marginBottom: 2,
  },

  // --- Info blocks ---
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 20,
  },
  infoBlock: {
    flexDirection: 'column',
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 9,
    color: colors.text,
    marginBottom: 1.5,
  },
  infoTextMuted: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 1,
  },

  // --- Items table ---
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    paddingBottom: 5,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    paddingVertical: 5,
    minHeight: 20,
  },
  colNum: { width: '6%', textAlign: 'center' as const },
  colDescription: { width: '44%', paddingRight: 8 },
  colQty: { width: '10%', textAlign: 'right' as const },
  colUnitPrice: { width: '20%', textAlign: 'right' as const },
  colAmount: { width: '20%', textAlign: 'right' as const },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableCellText: {
    fontSize: 9,
    color: colors.text,
  },
  tableCellMoney: {
    fontSize: 9,
    color: colors.text,
    fontFamily: 'Helvetica',
  },

  // --- Totals ---
  totalsSection: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  totalsTable: {
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginVertical: 4,
  },
  totalsLabel: {
    fontSize: 9,
    color: colors.muted,
  },
  totalsValue: {
    fontSize: 9,
    color: colors.text,
    fontFamily: 'Helvetica',
    textAlign: 'right' as const,
  },
  totalsFinalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  totalsFinalValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    textAlign: 'right' as const,
  },

  // --- Notes & Terms ---
  notesSection: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.5,
  },

  // --- Footer (fixed) ---
  footer: {
    position: 'absolute' as const,
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: colors.lineSoft,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: colors.faint,
  },
  footerDisclaimer: {
    fontSize: 6.5,
    color: colors.faint,
    fontStyle: 'italic' as const,
    maxWidth: '70%',
  },
});
