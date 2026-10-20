import React, { useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { brl, dateTime, num } from '../lib/format';
import { Badge, Button, Card, Loading, useToast } from '../components/ui';

export function Deposits() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const deposits = useAsync(() => api.deposits(from, to), [from, to, locale]);
  const { show } = useToast();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await api.downloadDepositsCsv(from, to);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `wano-deposits-${from}-${to}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      show(t('deposits.toastExported'));
    } catch (error) {
      show(error instanceof Error ? error.message : t('deposits.toastError'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const rows = deposits.data ?? [];
  const totalKg = rows.reduce((sum, row) => sum + row.weightGrams, 0) / 1000;
  const accepted = rows.filter((row) => row.accepted).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('deposits.eyebrow')}</div>
          <h1>{t('deposits.title')}</h1>
          <p>{t('deposits.subtitle')}</p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={() => deposits.reload()}>
            <RefreshCcw size={15} /> {t('common.refresh')}
          </Button>
          <Button onClick={download} disabled={downloading}>
            <Download size={15} /> {downloading ? t('deposits.exporting') : t('deposits.exportCsv')}
          </Button>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="toolbar__left">
            <label className="field" style={{ gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{t('deposits.from')}</span>
              <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={{ width: 160 }} />
            </label>
            <label className="field" style={{ gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{t('deposits.to')}</span>
              <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} style={{ width: 160 }} />
            </label>
          </div>
          <div className="toolbar__right">
            <Badge tone="green">{t('deposits.accepted', { count: accepted })}</Badge>
            <Badge tone="red">{t('deposits.rejected', { count: rows.length - accepted })}</Badge>
            <Badge tone="grey">{t('deposits.totalKg', { value: num(totalKg, 1) })}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        {deposits.loading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('deposits.colDate')}</th>
                  <th>{t('deposits.colUser')}</th>
                  <th>{t('deposits.colMachine')}</th>
                  <th>{t('deposits.colSku')}</th>
                  <th>{t('deposits.colMaterial')}</th>
                  <th>{t('deposits.colWeight')}</th>
                  <th>{t('deposits.colStatus')}</th>
                  <th>{t('deposits.colPoints')}</th>
                  <th>{t('deposits.colCashback')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateTime(row.createdAt)}</td>
                    <td className="table__main">{row.userName}</td>
                    <td>{row.machineCode}</td>
                    <td>
                      <div>{row.skuName}</div>
                      {row.rejectReason ? <div className="table__sub">{row.rejectReason}</div> : null}
                    </td>
                    <td>
                      <Badge tone="grey">{t(`material.${row.material}`, undefined, row.material)}</Badge>
                    </td>
                    <td className="table__num">{row.weightGrams} g</td>
                    <td>
                      {row.accepted ? (
                        <Badge tone="green" dot>{t('deposits.badgeAccepted')}</Badge>
                      ) : (
                        <Badge tone="red" dot>{t('deposits.badgeRejected')}</Badge>
                      )}
                    </td>
                    <td className="table__num">{num(row.points)}</td>
                    <td className="table__num">{brl(row.cashbackCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="note" style={{ marginTop: 12 }}>
        {t('deposits.note')}
      </div>
    </>
  );
}
