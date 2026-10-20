import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CircleDollarSign, Leaf, Recycle, Users, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { brl, num, pct, dateTime, initials } from '../lib/format';
import { Badge, Card, CardHead, Chart, Loading, Progress, Stat } from '../components/ui';

export function Overview() {
  const { t, locale } = useI18n();
  const metrics = useAsync(() => api.metrics(), []);
  const payouts = useAsync(() => api.payouts('pending'), []);
  const redemptions = useAsync(() => api.redemptions('all'), [locale]);

  if (metrics.loading || !metrics.data) return <Loading />;
  const m = metrics.data;
  const machineTotal = m.machines.online + m.machines.full + m.machines.maintenance;
  const onlinePct = machineTotal ? Math.round((m.machines.online / machineTotal) * 100) : 0;
  const pendingPayoutCount = payouts.data?.items.length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('overview.eyebrow')}</div>
          <h1>{t('overview.title')}</h1>
          <p>{t('overview.subtitle', { time: dateTime(new Date().toISOString()) })}</p>
        </div>
        <div className="actions">
          <Link className="btn btn--secondary" to="/deposits">
            {t('overview.exportDeposits')}
            <ArrowUpRight size={15} />
          </Link>
          <Link className="btn btn--primary" to="/payouts">
            {t('overview.pendingPayouts', { count: pendingPayoutCount })}
          </Link>
        </div>
      </div>

      <div className="kpi-grid kpi-grid--3">
        <Stat label={t('overview.kpiUsers')} value={num(m.users)} delta={{ text: t('overview.deltaUsers'), up: true }} />
        <Stat
          label={t('overview.kpiCollected')}
          value={num(m.depositsTotal)}
          foot={<span>{t('overview.footKg', { value: num(m.kgTotal, 1) })}</span>}
        />
        <Stat
          label={t('overview.kpiPoints')}
          value={num(m.pointsIssued)}
          foot={<span>{t('overview.footLiability')}</span>}
        />
        <Stat
          label={t('overview.kpiRedemptionRate')}
          value={pct(m.redemptionRate)}
          foot={<span>{t('overview.footActiveRewards', { count: m.activeRewards })}</span>}
        />
        <Stat
          label={t('overview.kpiPendingPayouts')}
          value={brl(m.payoutPendingCents)}
          foot={<span>{t('overview.footApprovalQueue')}</span>}
        />
        <Stat
          label={t('overview.kpiMachinesOnline')}
          value={`${onlinePct}%`}
          foot={<span>{t('overview.footOperating', { online: m.machines.online, total: machineTotal })}</span>}
        />
      </div>

      <div className="grid-2">
        <Card>
          <CardHead
            title={t('overview.chartTitle')}
            hint={t('overview.chartHint')}
            action={<Badge tone="green">{t('overview.chartBadge')}</Badge>}
          />
          {m.depositsByDay.length ? (
            <Chart data={m.depositsByDay} />
          ) : (
            <div className="empty">
              {t('overview.chartEmptyBefore')} <code>depositsByDay</code> {t('overview.chartEmptyAfter')}
            </div>
          )}
        </Card>

        <Card>
          <CardHead
            title={t('overview.fleetTitle')}
            hint={t('overview.fleetHint', { count: machineTotal })}
            action={
              <Link className="btn btn--ghost btn--sm" to="/machines">
                {t('overview.manage')}
              </Link>
            }
          />
          <div className="list">
            {[
              { label: t('overview.fleetAvailable'), value: m.machines.online, icon: Recycle, tone: 'green' as const },
              { label: t('overview.fleetFull'), value: m.machines.full, icon: Wallet, tone: 'amber' as const },
              { label: t('overview.fleetMaintenance'), value: m.machines.maintenance, icon: CircleDollarSign, tone: 'red' as const },
            ].map((row) => (
              <div className="list__row" key={row.label}>
                <div className="list__icon">
                  <row.icon />
                </div>
                <div className="list__main">
                  <div className="list__title">{row.label}</div>
                  <div className="list__sub">
                    {t('overview.fleetShare', { value: machineTotal ? Math.round((row.value / machineTotal) * 100) : 0 })}
                  </div>
                </div>
                <Badge tone={row.tone}>{t('overview.fleetCount', { count: row.value })}</Badge>
              </div>
            ))}
            <div className="list__row">
              <div className="list__icon">
                <Leaf />
              </div>
              <div className="list__main">
                <div className="list__title">{t('overview.co2')}</div>
                <div className="list__sub">{t('overview.co2Sub')}</div>
              </div>
              <div className="list__value">{num(m.co2SavedKg, 0)} kg</div>
            </div>
            <div className="list__row">
              <div className="list__icon">
                <Users />
              </div>
              <div className="list__main">
                <div className="list__title">{t('overview.activeCampaigns')}</div>
                <div className="list__sub">{t('overview.activeCampaignsSub')}</div>
              </div>
              <div className="list__value">{m.activeCampaigns}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card flat>
          <div style={{ padding: '20px 22px 0' }}>
            <CardHead
              title={t('overview.recentRedemptions')}
              hint={t('overview.recentRedemptionsHint')}
              action={
                <Link className="btn btn--ghost btn--sm" to="/redemptions">
                  {t('overview.viewAll')}
                </Link>
              }
            />
          </div>
          {redemptions.loading ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('overview.colUser')}</th>
                    <th>{t('overview.colReward')}</th>
                    <th>{t('overview.colPoints')}</th>
                    <th>{t('overview.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(redemptions.data ?? []).slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                            {initials(item.userName)}
                          </span>
                          <span className="table__main">{item.userName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="table__main">{item.rewardTitle}</div>
                        <div className="table__sub">{item.rewardPartner}</div>
                      </td>
                      <td className="table__num">{num(item.pointsSpent)}</td>
                      <td>
                        <Badge tone={item.status === 'active' ? 'green' : item.status === 'fulfilled' ? 'lime' : 'grey'}>
                          {t(`status.${item.status}`, undefined, item.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHead title={t('overview.healthTitle')} hint={t('overview.healthHint')} />
          <div className="split">
            <div className="split__item">
              <div className="split__label">{t('overview.uptime')}</div>
              <div className="split__value">{onlinePct}%</div>
              <div style={{ marginTop: 10 }}>
                <Progress value={onlinePct} />
              </div>
            </div>
            <div className="split__item">
              <div className="split__label">{t('overview.rejectionRate')}</div>
              <div className="split__value">3,2%</div>
              <div style={{ marginTop: 10 }}>
                <Progress value={3.2} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 22 }}>
            <div className="split__label">{t('overview.nextActions')}</div>
            <div className="list">
              <div className="list__row" style={{ padding: '9px 0' }}>
                <div className="list__main">
                  <div className="list__title">{t('overview.approvePayouts', { count: pendingPayoutCount })}</div>
                  <div className="list__sub">
                    {t('overview.queueTotal', { amount: brl(payouts.data?.totals.pendingCents ?? 0) })}
                  </div>
                </div>
                <Link className="btn btn--secondary btn--sm" to="/payouts">
                  {t('overview.review')}
                </Link>
              </div>
              <div className="list__row" style={{ padding: '9px 0' }}>
                <div className="list__main">
                  <div className="list__title">{t('overview.machineFull')}</div>
                  <div className="list__sub">{t('overview.machineFullSub')}</div>
                </div>
                <Link className="btn btn--secondary btn--sm" to="/machines">
                  {t('overview.viewFleet')}
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
