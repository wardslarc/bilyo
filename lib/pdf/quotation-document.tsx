import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { styles } from './shared/styles';
import { formatMoney } from '../money';
import { formatDate } from '../dates';

// --- Types ---

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

export interface BusinessInfo {
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  tin?: string;
  vatRegistered: boolean;
  logoUrl?: string | null;
}

export interface CustomerInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tin?: string;
}

export interface QuotationDocumentProps {
  number: string;
  items: LineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  vatRatePercent: number;
  vatCentavos: number;
  totalCentavos: number;
  issueDate: string | Date;
  validUntil: string | Date;
  notes?: string;
  terms?: string;
  business: BusinessInfo;
  customer: CustomerInfo;
}

// --- Sub-components ---

function Header({ business, number }: { business: BusinessInfo; number: string }) {
  const hasLogo = Boolean(business.logoUrl && business.logoUrl.trim());

  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        {hasLogo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={business.logoUrl!} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder} />
        )}
        <Text style={styles.businessName}>{business.businessName}</Text>
        {business.address && <Text style={styles.infoTextMuted}>{business.address}</Text>}
        {business.email && <Text style={styles.infoTextMuted}>{business.email}</Text>}
        {business.phone && <Text style={styles.infoTextMuted}>{business.phone}</Text>}
        {business.tin && <Text style={styles.infoTextMuted}>TIN: {business.tin}</Text>}
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.docTitle}>QUOTATION</Text>
        <Text style={styles.docNumber}>{number}</Text>
      </View>
    </View>
  );
}

function InfoSection({
  customer,
  issueDate,
  validUntil,
}: {
  customer: CustomerInfo;
  issueDate: string | Date;
  validUntil: string | Date;
}) {
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Prepared For</Text>
        <Text style={{ ...styles.infoText, fontFamily: 'Helvetica-Bold' }}>{customer.name}</Text>
        {customer.address && <Text style={styles.infoText}>{customer.address}</Text>}
        {customer.email && <Text style={styles.infoTextMuted}>{customer.email}</Text>}
        {customer.phone && <Text style={styles.infoTextMuted}>{customer.phone}</Text>}
        {customer.tin && <Text style={styles.infoTextMuted}>TIN: {customer.tin}</Text>}
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Details</Text>
        <Text style={styles.infoText}>Issue Date: {formatDate(issueDate)}</Text>
        <Text style={styles.infoText}>Valid Until: {formatDate(validUntil)}</Text>
      </View>
    </View>
  );
}

function ItemsTable({ items }: { items: LineItem[] }) {
  return (
    <View>
      {/* Table header — fixed on each page for pagination */}
      <View style={styles.tableHeader} fixed>
        <View style={styles.colNum}>
          <Text style={styles.tableHeaderText}>#</Text>
        </View>
        <View style={styles.colDescription}>
          <Text style={styles.tableHeaderText}>Description</Text>
        </View>
        <View style={styles.colQty}>
          <Text style={styles.tableHeaderText}>Qty</Text>
        </View>
        <View style={styles.colUnitPrice}>
          <Text style={styles.tableHeaderText}>Unit Price</Text>
        </View>
        <View style={styles.colAmount}>
          <Text style={styles.tableHeaderText}>Amount</Text>
        </View>
      </View>

      {/* Table rows */}
      {items.map((item, index) => (
        <View key={index} style={styles.tableRow} wrap={false}>
          <View style={styles.colNum}>
            <Text style={styles.tableCellText}>{index + 1}</Text>
          </View>
          <View style={styles.colDescription}>
            <Text style={styles.tableCellText}>{item.description}</Text>
          </View>
          <View style={styles.colQty}>
            <Text style={styles.tableCellMoney}>{item.quantity}</Text>
          </View>
          <View style={styles.colUnitPrice}>
            <Text style={styles.tableCellMoney}>{formatMoney(item.unitPriceCentavos)}</Text>
          </View>
          <View style={styles.colAmount}>
            <Text style={styles.tableCellMoney}>{formatMoney(item.amountCentavos)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TotalsBlock({
  subtotalCentavos,
  discountCentavos,
  vatRegistered,
  vatRatePercent,
  vatCentavos,
  totalCentavos,
}: {
  subtotalCentavos: number;
  discountCentavos: number;
  vatRegistered: boolean;
  vatRatePercent: number;
  vatCentavos: number;
  totalCentavos: number;
}) {
  return (
    <View style={styles.totalsSection}>
      <View style={styles.totalsTable}>
        {/* Subtotal */}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{formatMoney(subtotalCentavos)}</Text>
        </View>

        {/* Discount */}
        {discountCentavos > 0 && (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Discount</Text>
            <Text style={{ ...styles.totalsValue, color: '#dc2626' }}>
              -{formatMoney(discountCentavos)}
            </Text>
          </View>
        )}

        {/* VAT — only when business is VAT-registered (§5.2) */}
        {vatRegistered && (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>VAT ({vatRatePercent}%)</Text>
            <Text style={styles.totalsValue}>{formatMoney(vatCentavos)}</Text>
          </View>
        )}

        <View style={styles.totalsDivider} />

        {/* Grand total */}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsFinalLabel}>Total</Text>
          <Text style={styles.totalsFinalValue}>{formatMoney(totalCentavos)}</Text>
        </View>
      </View>
    </View>
  );
}

function NotesAndTerms({ notes, terms }: { notes?: string; terms?: string }) {
  if (!notes && !terms) return null;

  return (
    <View style={styles.notesSection}>
      {notes && (
        <View style={{ marginBottom: terms ? 12 : 0 }}>
          <Text style={styles.notesTitle}>Notes</Text>
          <Text style={styles.notesText}>{notes}</Text>
        </View>
      )}
      {terms && (
        <View>
          <Text style={styles.notesTitle}>Terms & Conditions</Text>
          <Text style={styles.notesText}>{terms}</Text>
        </View>
      )}
    </View>
  );
}

function Footer({ number }: { number: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerDisclaimer}>
        This document is a quotation and is not an official sales invoice or receipt.
        It is not valid for tax purposes.
      </Text>
      <Text style={styles.footerText}>{number}</Text>
    </View>
  );
}

// --- Main Document ---

export function QuotationDocument({
  number,
  items,
  subtotalCentavos,
  discountCentavos,
  vatRatePercent,
  vatCentavos,
  totalCentavos,
  issueDate,
  validUntil,
  notes,
  terms,
  business,
  customer,
}: QuotationDocumentProps) {
  return (
    <Document
      title={`Quotation ${number}`}
      author={business.businessName}
      subject={`Quotation for ${customer.name}`}
    >
      <Page size="A4" style={styles.page}>
        <Header business={business} number={number} />
        <InfoSection customer={customer} issueDate={issueDate} validUntil={validUntil} />
        <ItemsTable items={items} />
        <TotalsBlock
          subtotalCentavos={subtotalCentavos}
          discountCentavos={discountCentavos}
          vatRegistered={business.vatRegistered}
          vatRatePercent={vatRatePercent}
          vatCentavos={vatCentavos}
          totalCentavos={totalCentavos}
        />
        <NotesAndTerms notes={notes} terms={terms} />
        <Footer number={number} />
      </Page>
    </Document>
  );
}
