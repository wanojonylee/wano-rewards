import React from 'react';
import { CheckCircle2, RefreshCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { brl, date, dateTime, num } from '../lib/format';
import { Badge, Button, Card, CardHead, Loading } from '../components/ui';

export function Reconciliation() {
  const { t } = useI18n();
  const reconciliation = useAsync(() => api.reconciliation(), []);
  const data = reconciliation.data;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('recon.eyebrow')}</div>
          <h1>{t('recon.title')}</h1>
          <p>{t('recon.subtitle')}</p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={() => reconciliation.reload()}>
            <RefreshCcw size={15} /> {t('recon.recalculate')}
          </Button>
        </div>
      </div>

      {reconciliation.loading || !data ? (
        <Loading />
      ) : (
        <>
          <Card className={data.balanced ? '' : 'card--forest'} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                className="list__icon"
                style={{ width: 48, height: 48, borderRadius: 14, background: data.balanced ? 'var(--forest-soft)' : 'var(--accent-soft)', color: data.balanced ? 'var(--forest)' : 'var(--danger)' }}
              >
                {data.balanced ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="card__title">{data.balanced ? t('recon.balanced') : t('recon.unbalanced')}</div>
                <div className="card__hint">
                  {data.balanced
                    ? t('recon.balancedHint')
                    : t('recon.unbalancedHint', { amount: brl(data.varianceCents) })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="split__label">{t('recon.variance')}</div>
                <div className="split__value" style={{ color: data.balanced ? 'var(--success)' : 'var(--danger)' }}>
                  {brl(data.varianceCents)}
                </div>
              </div>
            </div>
          </Card>

          <div className="kpi-grid kpi-grid--4">
            <div className="kpi">
              <div className="kpi__label">{t('recon.kpiRequested')}</div>
              <div className="kpi__value kpi__value--small">{brl(data.requestedCents)}</div>
              <div className="kpi__foot">
                {t('recon.footRequested', { count: data.counts.requested, amount: brl(data.feeCents) })}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi__label">{t('recon.kpiPaid')}</div>
              <div className="kpi__value kpi__value--small">{brl(data.paidCents)}</div>
              <div className="kpi__foot">{t('recon.footPaid', { count: data.counts.paid })}</div>
            </div>
            <div className="kpi">
              <div className="kpi__label">{t('recon.kpiPending')}</div>
              <div className="kpi__value kpi__value--small">{brl(data.pendingCents)}</div>
              <div className="kpi__foot">{t('recon.footPending', { count: data.counts.pending })}</div>
            </div>
            <div className="kpi">
              <div className="kpi__label">{t('recon.kpiRefunded')}</div>
              <div className="kpi__value kpi__value--small">{brl(data.refundedCents)}</div>
              <div className="kpi__foot">{t('recon.footFailed', { count: data.counts.failed })}</div>
            </div>
          </div>

          <div className="grid-2--even grid-2">
            <Card>
              <CardHead title={t('recon.ledgerProof')} hint={t('recon.ledgerProofHint')} />
              <table className="table" style={{ minWidth: 0 }}>
                <tbody>
                  <tr>
                    <td>{t('recon.rowLedgerDebits')}</td>
                    <td className="table__num">{brl(data.ledgerPayoutCents)}</td>
                  </tr>
                  <tr>
                    <td>{t('recon.rowProviderPaid')}</td>
                    <td className="table__num">{brl(data.paidCents + data.pendingCents)}</td>
                  </tr>
                  <tr>
                    <td>{t('recon.rowFailureRefunds')}</td>
                    <td className="table__num">{brl(data.refundedCents)}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{t('recon.rowVariance')}</strong>
                    </td>
                    <td className="table__num">
                      <Badge tone={data.varianceCents === 0 ? 'green' : 'red'}>{brl(data.varianceCents)}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card>
              <CardHead title={t('recon.liabilities')} hint={t('recon.liabilitiesHint')} />
              <div className="split">
                <div className="split__item">
                  <div className="split__label">{t('recon.pointsOutstanding')}</div>
                  <div className="split__value">{num(data.liabilities.pointsOutstanding)}</div>
                </div>
                <div className="split__item">
                  <div className="split__label">{t('recon.creditOutstanding')}</div>
                  <div className="split__value">{brl(data.liabilities.creditOutstandingCents)}</div>
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                <div className="split__label">{t('recon.withdrawable')}</div>
                <div className="split__value">{brl(data.liabilities.withdrawableOutstandingCents)}</div>
              </div>
              <div style={{ marginTop: 16 }}>
                <Badge tone={data.liabilities.balanced ? 'green' : 'red'} dot>
                  {data.liabilities.balanced ? t('recon.balancesOk') : t('recon.balancesCheck')}
                </Badge>
              </div>
            </Card>
          </div>

          <Card style={{ marginTop: 16 }}>
            <CardHead
              title={t('recon.byProvider')}
              hint={t('recon.generatedAt', { time: dateTime(data.generatedAt) })}
              action={<Badge tone="green">{t('recon.providerCount', { count: data.providers.length })}</Badge>}
            />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('recon.colProvider')}</th>
                    <th>{t('recon.colPayouts')}</th>
                    <th>{t('recon.colVolume')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map((provider) => (
                    <tr key={provider.provider}>
                      <td className="table__main">
                        <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--success)' }} />
                        {provider.provider}
                      </td>
                      <td>{provider.count}</td>
                      <td className="table__num">{brl(provider.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note" style={{ marginTop: 14 }}>
              {t('recon.windowNote', { from: date(data.range.from), to: date(data.range.to) })}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
