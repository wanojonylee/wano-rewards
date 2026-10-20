import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { dateTime, initials, num } from '../lib/format';
import { Badge, Button, Card, Empty, Loading, useToast } from '../components/ui';

const tabs = [
  { value: 'all', labelKey: 'redemptions.tabAll' },
  { value: 'active', labelKey: 'redemptions.tabActive' },
  { value: 'used', labelKey: 'redemptions.tabUsed' },
  { value: 'fulfilled', labelKey: 'redemptions.tabFulfilled' },
  { value: 'expired', labelKey: 'redemptions.tabExpired' },
];

export function Redemptions() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState('all');
  const { show } = useToast();
  const redemptions = useAsync(() => api.redemptions(status), [status, locale]);
  const [acting, setActing] = useState<string | null>(null);

  const badge = (value: string) => {
    if (value === 'active') return <Badge tone="green" dot>{t('status.active')}</Badge>;
    if (value === 'used') return <Badge tone="grey" dot>{t('status.used')}</Badge>;
    if (value === 'fulfilled') return <Badge tone="lime" dot>{t('status.fulfilled')}</Badge>;
    return <Badge tone="amber" dot>{t('status.expired')}</Badge>;
  };

  const fulfill = async (id: string) => {
    setActing(id);
    try {
      await api.fulfillRedemption(id);
      show(t('redemptions.toastFulfilled'));
      redemptions.reload();
    } catch (error) {
      show(error instanceof Error ? error.message : t('redemptions.toastError'), 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('redemptions.eyebrow')}</div>
          <h1>{t('redemptions.title')}</h1>
          <p>{t('redemptions.subtitle')}</p>
        </div>
        <Button variant="secondary" onClick={() => redemptions.reload()}>
          <RefreshCcw size={15} /> {t('common.refresh')}
        </Button>
      </div>

      <Card>
        <div className="toolbar">
          <div className="segmented">
            {tabs.map((tab) => (
              <button key={tab.value} className={status === tab.value ? 'active' : ''} onClick={() => setStatus(tab.value)}>
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div className="toolbar__right">
            <Badge tone="green">{t('redemptions.records', { count: redemptions.data?.length ?? 0 })}</Badge>
          </div>
        </div>

        {redemptions.loading ? (
          <Loading />
        ) : (redemptions.data?.length ?? 0) === 0 ? (
          <Empty>{t('redemptions.empty')}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('redemptions.colUser')}</th>
                  <th>{t('redemptions.colReward')}</th>
                  <th>{t('redemptions.colCode')}</th>
                  <th>{t('redemptions.colPoints')}</th>
                  <th>{t('redemptions.colIssued')}</th>
                  <th>{t('redemptions.colExpires')}</th>
                  <th>{t('redemptions.colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {redemptions.data?.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                          {initials(item.userName)}
                        </span>
                        <div>
                          <div className="table__main">{item.userName}</div>
                          <div className="table__sub">{item.userPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table__main">{item.rewardTitle}</div>
                      <div className="table__sub">{item.rewardPartner}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{item.code}</span>
                    </td>
                    <td className="table__num">{num(item.pointsSpent)}</td>
                    <td>{dateTime(item.createdAt)}</td>
                    <td>{dateTime(item.expiresAt)}</td>
                    <td>{badge(item.status)}</td>
                    <td>
                      <div className="table__actions">
                        {item.status === 'active' ? (
                          <Button size="sm" variant="secondary" disabled={acting === item.id} onClick={() => fulfill(item.id)}>
                            {t('redemptions.fulfill')}
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
    </>
  );
}
