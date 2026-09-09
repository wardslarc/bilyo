import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { styles } from './styles.ts';
import { formatMoney } from '../../money.ts';
import { formatDate } from '../../dates.ts';

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

export interface PdfBusinessInfo {
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  logoUrl?: string | null;
}

export interface PdfCustomerInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface BaseDocumentLayoutProps {
  kind?: 'quotation';
  documentTitle: string; // e.g. 'QUOTATION'
  number: string;
  business: PdfBusinessInfo;
  customer: PdfCustomerInfo;
  items: PdfLineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
  issueDate: string | Date;
  secondaryDateLabel: string; // e.g. 'Valid Until'
  secondaryDate: string | Date;
  notes?: string;
  terms?: string;
  disclaimer: string;
}

export function DocumentHeader({
  business,
  number,
  title,
}: {
  business: PdfBusinessInfo;
  number: string;
  title: string;
}) {
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
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.docNumber}>{number}</Text>
      </View>
    </View>
  );
}

export function DocumentInfoSection({
  customer,
  issueDate,
  secondaryDateLabel,
  secondaryDate,
}: {
  customer: PdfCustomerInfo;
  issueDate: string | Date;
  secondaryDateLabel: string;
  secondaryDate: string | Date;
}) {
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Prepared For</Text>
        <Text style={{ ...styles.infoText, fontFamily: 'Helvetica-Bold' }}>{customer.name}</Text>
        {customer.address && <Text style={styles.infoText}>{customer.address}</Text>}
        {customer.email && <Text style={styles.infoTextMuted}>{customer.email}</Text>}
        {customer.phone && <Text style={styles.infoTextMuted}>{customer.phone}</Text>}
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Details</Text>
        <Text style={styles.infoText}>Issue Date: {formatDate(issueDate)}</Text>
        <Text style={styles.infoText}>
          {secondaryDateLabel}: {formatDate(secondaryDate)}
        </Text>
      </View>
    </View>
  );
}

export function DocumentItemsTable({ items }: { items: PdfLineItem[] }) {
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

export function DocumentTotalsBlock({
  subtotalCentavos,
  discountCentavos,
  totalCentavos,
}: {
  subtotalCentavos: number;
  discountCentavos: number;
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

export function DocumentNotesAndTerms({
  notes,
  terms,
}: {
  notes?: string;
  terms?: string;
}) {
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

export function DocumentFooter({
  number,
  disclaimer,
}: {
  number: string;
  disclaimer: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerDisclaimer}>{disclaimer}</Text>
      <Text style={styles.footerText}>{number}</Text>
    </View>
  );
}

export function BaseDocumentLayout({
  documentTitle,
  number,
  business,
  customer,
  items,
  subtotalCentavos,
  discountCentavos,
  totalCentavos,
  issueDate,
  secondaryDateLabel,
  secondaryDate,
  notes,
  terms,
  disclaimer,
}: BaseDocumentLayoutProps) {
  return (
    <Document
      title={`${documentTitle} ${number}`}
      author={business.businessName}
      subject={`${documentTitle} for ${customer.name}`}
    >
      <Page size="A4" style={styles.page}>
        <DocumentHeader business={business} number={number} title={documentTitle} />
        <DocumentInfoSection
          customer={customer}
          issueDate={issueDate}
          secondaryDateLabel={secondaryDateLabel}
          secondaryDate={secondaryDate}
        />
        <DocumentItemsTable items={items} />
        <DocumentTotalsBlock
          subtotalCentavos={subtotalCentavos}
          discountCentavos={discountCentavos}
          totalCentavos={totalCentavos}
        />
        <DocumentNotesAndTerms notes={notes} terms={terms} />
        <DocumentFooter number={number} disclaimer={disclaimer} />
      </Page>
    </Document>
  );
}
