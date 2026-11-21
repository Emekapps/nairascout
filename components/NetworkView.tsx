'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitBranch, Lock } from 'lucide-react';
import type { NairaScoutSnapshot } from '@/lib/nairascout-store';
import {
  CommissionBreakdown,
  formatKoboToNaira,
} from '@/lib/commission-engine';

interface NetworkViewProps {
  snapshot: NairaScoutSnapshot;
}

export default function NetworkView({ snapshot }: NetworkViewProps) {
  const [subTab, setSubTab] = useState<'explorer' | 'simulator'>('explorer');

  // Simulator controls
  const [merchNaira, setMerchNaira] = useState<number>(100000);
  const [depth, setDepth] = useState<number>(13);
  const [isReferral, setIsReferral] = useState<boolean>(true);
  const [ineligibleGens, setIneligibleGens] = useState<number[]>([]);
  const [simResult, setSimResult] = useState<CommissionBreakdown | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const totalNetworkScouts = snapshot.downstreamGenerations.reduce(
    (sum, g) => sum + g.scoutCount,
    0
  );
  const directGen1Count = snapshot.downstreamGenerations[0]?.scoutCount ?? 0;

  useEffect(() => {
    let active = true;
    const runSim = async () => {
      setSimLoading(true);
      try {
        const res = await fetch('/api/nairascout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'simulate_commission',
            merchandiseNaira: merchNaira,
            depth,
            ineligibleGens,
            isReferral,
          }),
        });
        const data = await res.json();
        if (active && data.breakdown) {
          setSimResult(data.breakdown);
        }
      } finally {
        if (active) setSimLoading(false);
      }
    };
    runSim();
    return () => {
      active = false;
    };
  }, [merchNaira, depth, ineligibleGens, isReferral]);

  const toggleGenIneligible = (gen: number) => {
    setIneligibleGens((prev) =>
      prev.includes(gen) ? prev.filter((g) => g !== gen) : [...prev, gen]
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DE] pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#111814]">
            Thirteen-Generation Network &amp; Engine
          </h1>
          <p className="mt-1.5 text-sm text-[#4B554E] max-w-2xl">
            Inspect your permanent referral ancestry and downstream generations, or test the
            server-side kobo commission engine across depths 1–13.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFEFE9] rounded-lg shrink-0 self-start">
          <button
            type="button"
            onClick={() => setSubTab('explorer')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'explorer' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            Network Explorer
          </button>
          <button
            type="button"
            onClick={() => setSubTab('simulator')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'simulator' ? 'bg-white text-[#111814] shadow-xs' : 'text-[#556158]'
            }`}
          >
            13-Gen Commission Calculator
          </button>
        </div>
      </div>

      {subTab === 'explorer' ? (
        <div className="space-y-10">
          {/* Privacy-preserving summary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-[#E4E4DE] pb-8">
            <div>
              <p className="text-xs text-[#5C665E]">Permanent Direct Referrer (Gen 1)</p>
              <p className="mt-1 font-display text-lg font-semibold text-[#111814]">
                {snapshot.upstreamAncestry[0]
                  ? `${snapshot.upstreamAncestry[0].displayName}`
                  : 'Organic Registration'}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#5C665E]">
                {snapshot.upstreamAncestry[0]
                  ? `@${snapshot.upstreamAncestry[0].handle} · Permanent`
                  : 'No direct referrer'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">Upstream Ancestry Depth</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
                {snapshot.upstreamAncestry.length} / 13
              </p>
              <p className="mt-0.5 text-xs text-[#5C665E]">Locked at registration</p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">Direct Downstream Scouts (Gen 1)</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
                {directGen1Count}
              </p>
              <p className="mt-0.5 text-xs text-[#5C665E]">Zero recruitment fees paid</p>
            </div>
            <div>
              <p className="text-xs text-[#5C665E]">Total 13-Gen Network Reach</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-[#111814] tabular-nums">
                {totalNetworkScouts}
              </p>
              <p className="mt-0.5 text-xs text-[#5C665E]">Aggregate counts only</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Downstream 13-Generation Breakdown */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Downstream Network by Generation (Gen 1–13)
                </h2>
                <span className="text-xs text-[#5C665E]">
                  Your position above downstream Seller Scouts
                </span>
              </div>

              <div className="bg-white border border-[#E4E4DE] rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E4E4DE] text-xs text-[#5C665E]">
                      <th className="py-3 px-4 font-medium">Generation</th>
                      <th className="py-3 px-4 font-medium text-right">Scouts</th>
                      <th className="py-3 px-4 font-medium text-right">Eligible</th>
                      <th className="py-3 px-4 font-medium text-right">Pool Share (4–13)</th>
                      <th className="py-3 px-4 font-medium">Permitted Handles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECECE6]">
                    {snapshot.downstreamGenerations.map((row) => (
                      <tr key={row.generation} className="hover:bg-[#FAFAF8]">
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#111814]">
                          Gen {row.generation}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right tabular-nums text-[#111814]">
                          {row.scoutCount}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right tabular-nums text-[#0B6E4F]">
                          {row.eligibleCount}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right tabular-nums text-[#4B554E]">
                          {row.scheduleFractionAtFullDepth}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-[#5C665E]">
                          {row.sampleHandles.length > 0
                            ? row.sampleHandles.join(', ')
                            : 'Privacy-protected aggregate count'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upstream Permanent Ancestry Chain */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-[#111814]">
                  Your Permanent Upstream Ancestry
                </h2>
                <Lock className="w-4 h-4 text-[#5C665E]" aria-hidden="true" />
              </div>

              <div className="bg-white border border-[#E4E4DE] rounded-xl p-5 space-y-3">
                <p className="text-xs text-[#5C665E] leading-relaxed">
                  Private contact details, bank accounts, and individual earnings are never exposed.
                  Ineligible ancestors retain their fixed generation slot and receive ₦0.00.
                </p>

                <div className="divide-y divide-[#ECECE6]">
                  {snapshot.upstreamAncestry.map((node) => (
                    <div
                      key={node.generation}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-semibold text-[#5C665E] w-12 shrink-0">
                          Gen {node.generation}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-[#111814] truncate">{node.displayName}</p>
                          <p className="font-mono text-xs text-[#5C665E]">@{node.handle}</p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 text-xs">
                        {node.eligible ? (
                          <>
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-[#0B6E4F]"
                              aria-hidden="true"
                            />
                            <span className="text-[#0B6E4F] font-medium">Eligible</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-[#B45309]"
                              aria-hidden="true"
                            />
                            <span className="text-[#B45309] font-medium">Ineligible (₦0)</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Interactive 13-Generation Commission Engine Simulator */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white border border-[#E4E4DE] rounded-xl p-6 space-y-6 self-start">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#111814]">
                Commission Engine Parameters
              </h2>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="sim-merch"
                className="block text-xs font-medium text-[#4B554E]"
              >
                Eligible Merchandise Revenue (₦, excl. delivery &amp; tax)
              </label>
              <input
                id="sim-merch"
                type="number"
                min={1000}
                step={5000}
                value={merchNaira}
                onChange={(e) => setMerchNaira(Math.max(0, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 font-mono text-sm bg-white border border-[#D8D8D0] rounded-lg focus:outline-none focus:border-[#0B6E4F] tabular-nums"
              />
              <div className="flex items-center gap-2 pt-1">
                {[25000, 100000, 250000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMerchNaira(preset)}
                    className="px-2.5 py-1 text-xs font-mono bg-[#F3F3EF] hover:bg-[#E4E4DC] rounded text-[#111814] cursor-pointer"
                  >
                    ₦{preset.toLocaleString('en-NG')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sim-depth" className="font-medium text-[#4B554E]">
                  Actual Seller Ancestry Depth
                </label>
                <span className="font-mono font-semibold text-[#111814]">
                  {depth} {depth === 1 ? 'generation' : 'generations'}
                </span>
              </div>
              <input
                id="sim-depth"
                type="range"
                min={1}
                max={13}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full accent-[#0B6E4F] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-[#6C776E]">
                <span>1 (1/2)</span>
                <span>2 (1/4, 1/5)</span>
                <span>3 (1/5, 1/6, 1/10)</span>
                <span>4–13 (Extended)</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#4B554E]">Checkout Attribution Type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsReferral(true)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border cursor-pointer ${
                    isReferral
                      ? 'bg-[#0B6E4F] text-white border-[#0B6E4F]'
                      : 'bg-white text-[#4B554E] border-[#D8D8D0]'
                  }`}
                >
                  Referral-Card Buy
                </button>
                <button
                  type="button"
                  onClick={() => setIsReferral(false)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border cursor-pointer ${
                    !isReferral
                      ? 'bg-[#111814] text-white border-[#111814]'
                      : 'bg-white text-[#4B554E] border-[#D8D8D0]'
                  }`}
                >
                  Direct Marketplace
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#ECECE6]">
              <p className="text-xs font-medium text-[#4B554E]">
                Simulate Ineligible Ancestors (Verify No-Promotion Rule)
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: depth }, (_, i) => i + 1).map((g) => {
                  const off = ineligibleGens.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenIneligible(g)}
                      className={`py-1.5 text-xs font-mono rounded border cursor-pointer ${
                        off
                          ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C] line-through'
                          : 'bg-[#FAFAF8] border-[#D8D8D0] text-[#111814]'
                      }`}
                    >
                      G{g}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right side: Exact Server-Side Output */}
          <div className="lg:col-span-7 space-y-5">
            {simResult && (
              <>
                <div className="bg-white border border-[#E4E4DE] rounded-xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-[#5C665E]">Seller Proceeds (90%)</p>
                    <p className="mt-1 font-mono text-base font-semibold text-[#111814] tabular-nums">
                      {formatKoboToNaira(simResult.sellerProceedsKobo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C665E]">NairaScout Fee (10%)</p>
                    <p className="mt-1 font-mono text-base font-semibold text-[#111814] tabular-nums">
                      {formatKoboToNaira(simResult.marketplaceCommissionKobo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C665E]">20% Referral Pool</p>
                    <p className="mt-1 font-mono text-base font-semibold text-[#0B6E4F] tabular-nums">
                      {formatKoboToNaira(simResult.referralPoolKobo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C665E]">Undistributed Retained</p>
                    <p className="mt-1 font-mono text-base font-semibold text-[#4B554E] tabular-nums">
                      {formatKoboToNaira(simResult.undistributedRetainedKobo)}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-[#E4E4DE] rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E4E4DE] flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111814]">
                      {simResult.scheduleName}
                    </span>
                    <span className="font-mono text-[#5C665E]">
                      {simLoading ? 'Calculating...' : `Engine ${simResult.ruleVersion}`}
                    </span>
                  </div>

                  {simResult.allocations.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[#5C665E]">
                      Direct marketplace purchase generates ₦0.00 referral pool and ₦0.00
                      generation commissions.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[#E4E4DE] text-xs text-[#5C665E]">
                          <th className="py-2.5 px-4 font-medium">Generation</th>
                          <th className="py-2.5 px-4 font-medium">Fraction</th>
                          <th className="py-2.5 px-4 font-medium">Eligibility</th>
                          <th className="py-2.5 px-4 font-medium text-right">Allocation (₦)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECECE6]">
                        {simResult.allocations.map((row) => (
                          <tr key={row.generation} className="hover:bg-[#FAFAF8]">
                            <td className="py-2.5 px-4 font-mono text-xs font-semibold text-[#111814]">
                              Gen {row.generation}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-xs text-[#4B554E]">
                              {row.fractionLabel}
                            </td>
                            <td className="py-2.5 px-4 text-xs">
                              {row.eligible ? (
                                <span className="text-[#0B6E4F] font-medium">Eligible</span>
                              ) : (
                                <span className="text-[#B45309] font-medium">
                                  Ineligible (Slot kept empty)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-right tabular-nums font-semibold text-[#111814]">
                              {formatKoboToNaira(row.amountKobo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#D8D8D0] bg-[#FAFAF8] font-semibold">
                          <td colSpan={3} className="py-3 px-4 text-xs text-[#111814]">
                            Total Allocated to Eligible Scouts
                          </td>
                          <td className="py-3 px-4 font-mono text-right tabular-nums text-[#0B6E4F]">
                            {formatKoboToNaira(simResult.totalAllocatedKobo)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
