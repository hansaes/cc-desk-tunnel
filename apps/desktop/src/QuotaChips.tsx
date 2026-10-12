import { useState } from 'react';
import type { RateLimits } from '@cc-desk-tunnel/protocol';
import type { ProxyClient } from './client.ts';
import { dollars, quotaName, tokens, useUsageSummary } from './UsagePanel.tsx';

// The two windows that decide whether work can go on right now. A plan that reports one weekly window per
// model has several of the second kind; the emptiest of them is the one that will stop the work first.
const kinds = [
  { label: '时', belongs: (name: string) => name === 'five_hour' },
  // `seven_day_oauth_apps` limits other apps on the account, not the work in front of the user.
  {
    label: '周',
    belongs: (name: string) => name.startsWith('seven_day') && name !== 'seven_day_oauth_apps',
  },
];
// Green while most of the window is left, yellow from 70% down, red from 30% down.
const level = (left: number) => (left <= 30 ? 'danger' : left <= 70 ? 'warn' : 'ok');

// The subscription quota beside the input box: whether a long task can start should be visible while the
// message is being written, not one page away. Hovering a chip spells the window out and adds what this
// period cost; clicking one opens the account page, which keeps the full breakdown.
export default function QuotaChips({
  client,
  quota,
  open,
}: {
  client: ProxyClient;
  quota: RateLimits | null;
  open: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  // Periods are cut by the quota readings, so there is nothing to ask for until one has arrived.
  const summary = useUsageSummary(client, quota?.available ? (quota.measuredAt ?? '') : null);
  if (!quota?.available) return null;
  const shown = kinds.flatMap((kind) => {
    const window = quota.windows
      .filter((item) => kind.belongs(item.name) && item.utilization != null)
      .sort((a, b) => b.utilization! - a.utilization!)[0];
    return window ? [{ label: kind.label, window }] : [];
  });
  if (!shown.length) return null;
  return (
    <div className="quota-chips">
      {shown.map(({ label, window }) => {
        const used = Math.round(window.utilization!);
        const left = Math.min(100, Math.max(0, 100 - used));
        const name = quotaName(window.name) ?? window.name;
        const period = summary?.windows.find((item) => item.name === window.name);
        return (
          <div
            className="quota-control"
            key={label}
            onMouseEnter={() => setHover(label)}
            onMouseLeave={() => setHover(null)}
          >
            <button
              type="button"
              className={`chip quota-chip ${level(left)}`}
              aria-label={`${name}剩余 ${left}%，打开账号与额度`}
              aria-expanded={hover === label}
              title={`${name}剩余 ${left}%`}
              onFocus={() => setHover(label)}
              onBlur={() => setHover(null)}
              onClick={open}
            >
              <span>
                {label} {left}%
              </span>
            </button>
            {hover === label && (
              <div className="quota-tooltip" role="tooltip">
                <strong>{name}</strong>
                <span>
                  剩余 {left}%（已用 {used}%）
                </span>
                <span>
                  {window.resetsAt
                    ? `重置 ${new Date(window.resetsAt).toLocaleString('zh-CN')}`
                    : '重置时间未提供'}
                </span>
                {period && (
                  <span className="quota-period-line">
                    <span>本周期 {period.requests.toLocaleString('zh-CN')} 次请求</span>
                    <span>
                      {tokens(
                        period.inputTokens +
                          period.outputTokens +
                          period.cacheReadTokens +
                          period.cacheCreationTokens,
                      )}{' '}
                      tokens
                    </span>
                    <span>等价 {dollars(period.costUsd)}</span>
                  </span>
                )}
                <small>
                  {quota.measuredAt
                    ? `${new Date(quota.measuredAt).toLocaleTimeString('zh-CN')} · 原生读数`
                    : '原生读数'}
                  ，点开看调用日志
                </small>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
