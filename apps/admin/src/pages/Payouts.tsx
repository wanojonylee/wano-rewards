import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RefreshCcw, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { brl, dateTime, initials } from '../lib/format';
import { Badge, Button, Card, CardHead, Empty, Loading } from '../components/ui';
import { useToast } from '../components/ui';

const tabs = [
  { value: 'pending', labelKey: 'payouts.tabPending' },
  { value: 'paid', labelKey: 'payouts.tabPaid' },
  { value: 'failed', labelKey: 'payouts.tabFailed' },
  { value: 'all', labelKey: 'payouts.tabAll' },
];

export function Payouts() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState('all');
  const { show } = useToast();
  const payouts = useAsync(() => api.payouts(status), [status, locale]);
  const [acting, setActing] = useState<string | null>(null);

  const statusBadge = (value: string) => {
    if (value === 'pending') return <Badge tone="amber" dot>{t('status.pending')}</Badge>;
    if (value === 'paid') return <Badge tone="green" dot>{t('status.paid')}</Badge>;
    return <Badge tone="red" dot>{t('status.failed')}</Badge>;
  };

  const act = async (id: string, action: 'paid' | 'retry' | 'fail') => {
    setActing(id);
    try {
      if (action === 'paid') await api.markPayoutPaid(id);
      if (action === 'retry') await api.retryPayout(id);
      if (action === 'fail') await api.failPayout(id);
      show(
        action === 'paid' ? t('payouts.toastPaid') : action === 'retry' ? t('payouts.toastRetried') : t('payouts.toastFailed'),
      );
      payouts.reload();
    } catch (error) {
      show(error instanceof Error ? error.message : t('payouts.toastError'), 'error');
    } finally {
      setActing(null);
    }
  };

  const totals = payouts.data?.totals;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('payouts.eyebrow')}</div>
          <h1>{t('payouts.title')}</h1>
          <p>{t('payouts.subtitle')}</p>
        </div>
        <div className="actions">
          <Link className="btn btn--secondary" to="/reconciliation">
            {t('payouts.viewReconciliation')}
          </Link>
        </div>
      </div>

      <div className="kpi-grid kpi-grid--4">
        <div className="kpi">
          <div className="kpi__label">{t('payouts.kpiPending')}</div>
          <div className="kpi__value kpi__value--small">{brl(totals?.pendingCents ?? 0)}</div>
          <div className="kpi__foot">{t('payouts.footAwaiting')}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">{t('payouts.kpiPaid')}</div>
          <div className="kpi__value kpi__value--small">{brl(totals?.paidCents ?? 0)}</div>
          <div className="kpi__foot">{t('payouts.footSettled')}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">{t('payouts.kpiFailed')}</div>
          <div className="kpi__value kpi__value--small">{brl(totals?.failedCents ?? 0)}</div>
          <div className="kpi__foot">{t('payouts.footRefunded')}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">{t('payouts.kpiRequests')}</div>
          <div className="kpi__value kpi__value--small">{totals?.count ?? 0}</div>
          <div className="kpi__foot">{t('payouts.footFilter')}</div>
        </div>
      </div>

      <Card>
        <div className="toolbar">
          <div className="toolbar__left">
            <div className="segmented">
              {tabs.map((tab) => (
                <button key={tab.value} className={status === tab.value ? 'active' : ''} onClick={() => setStatus(tab.value)}>
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar__right">
            <Button variant="ghost" size="sm" onClick={() => payouts.reload()}>
              <RefreshCcw size={14} /> {t('common.refresh')}
            </Button>
          </div>
        </div>

        {payouts.loading ? (
          <Loading />
        ) : payouts.error ? (
          <Empty>{payouts.error}</Empty>
        ) : (payouts.data?.items.length ?? 0) === 0 ? (
          <Empty>{t('payouts.empty')}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('payouts.colBeneficiary')}</th>
                  <th>{t('payouts.colAmount')}</th>
                  <th>{t('payouts.colPixKey')}</th>
                  <th>{t('payouts.colProvider')}</th>
                  <th>{t('payouts.colRequested')}</th>
                  <th>{t('payouts.colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payouts.data?.items.map((payout) => (
                  <tr key={payout.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: 10 }}>
                          {initials(payout.userName)}
                        </span>
                        <div>
                          <div className="table__main">{payout.userName}</div>
                          <div className="table__sub">{payout.userPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table__main">{brl(payout.amountCents)}</div>
                      <div className="table__sub">
                        {t('payouts.netFee', { net: brl(payout.netCents), fee: brl(payout.feeCents) })}
                      </div>
                    </td>
                    <td className="table__main">{payout.pixKeyMasked}</td>
                    <td>
                      <div className="table__main">{payout.provider}</div>
                      <div className="table__sub">{payout.providerPayoutId ?? '—'}</div>
                    </td>
                    <td>{dateTime(payout.createdAt)}</td>
                    <td>
                      {statusBadge(payout.status)}
                      {payout.failureReason ? <div className="table__sub">{payout.failureReason}</div> : null}
                    </td>
                    <td>
                      <div className="table__actions">
                        {payout.status === 'pending' ? (
                          <>
                            <Button size="sm" variant="primary" disabled={acting === payout.id} onClick={() => act(payout.id, 'paid')}>
                              <CheckCircle2 size={13} /> {t('status.paid')}
                            </Button>
                            <Button size="sm" variant="danger" disabled={acting === payout.id} onClick={() => act(payout.id, 'fail')}>
                              <XCircle size={13} />
                            </Button>
                          </>
                        ) : null}
                        {payout.status === 'failed' ? (
                          <Button size="sm" variant="secondary" disabled={acting === payout.id} onClick={() => act(payout.id, 'retry')}>
                            <RefreshCcw size={13} /> {t('payouts.retry')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card muted style={{ marginTop: 16 }}>
        <CardHead title={t('payouts.howItWorks')} />
        <div className="note">{t('payouts.note')}</div>
      </Card>
    </>
  );
}
