// ============================================================================
// DASHBOARD ENHANCEMENTS - Success Patterns & Healing Status
// ============================================================================

console.log('Dashboard Enhancements Module Loaded');

// ============================================================================
// HEALING STATUS UPDATE
// ============================================================================
async function updateHealingStatus() {
  try {
    const status = await API.getHealingStatus();
    const statusEl = document.querySelector('[data-metric="healing-status"]');
    const ageEl = document.querySelector('[data-metric="healing-age"]');
    const flowIndicator = document.querySelector('.flow-indicator');
    const flowStats = document.querySelector('.flow-stats');
    const flowPatterns = document.getElementById('flow-patterns');
    const flowPatternsList = document.getElementById('flow-patterns-list');

    if (!statusEl || !ageEl) return; // Elements not loaded yet

    if (!status || status.error) {
      statusEl.innerHTML = '<span class="status-indicator">🔴</span> <span>Error</span>';
      ageEl.textContent = 'Last run: unknown';
      if (flowIndicator) {
        flowIndicator.setAttribute('data-flow-status', 'error');
        flowIndicator.innerHTML = '<span class="status-dot">🔴</span> <span>Connection Error</span>';
      }
      if (flowStats) flowStats.innerHTML = '<span>Unable to fetch healing status</span>';
      if (flowPatterns) flowPatterns.style.display = 'none';
      return;
    }

    if (status.active) {
      statusEl.innerHTML = '<span class="status-indicator">🟢</span> <span>Active</span>';
      const ageSeconds = Math.round(status.age_seconds || 0);
      ageEl.textContent = `Active ${ageSeconds}s ago`;

      if (flowIndicator) {
        flowIndicator.setAttribute('data-flow-status', 'active');
        flowIndicator.innerHTML = '<span class="status-dot">🟢</span> <span>Healing in progress...</span>';
      }

      if (flowStats) {
        const errorCode = status.last_error || 'unknown';
        const patternCount = status.patterns_available || 0;
        flowStats.innerHTML = `<span>Error: <code>${errorCode}</code></span><br><span>${patternCount} patterns available</span>`;
      }

      if (flowPatterns && flowPatternsList && status.patterns && status.patterns.length > 0) {
        flowPatterns.style.display = 'block';
        flowPatternsList.innerHTML = status.patterns.map(p => `
          <li>
            <span class="pattern-code">${p.cluster_id || p.error_code}</span>
            <span class="pattern-badge">${p.success_count}× (${(p.avg_confidence * 100).toFixed(0)}%)</span>
            <span class="pattern-description">${p.fix_description}</span>
          </li>
        `).join('');
      } else if (flowPatterns) {
        flowPatterns.style.display = 'none';
      }
    } else {
      statusEl.innerHTML = '<span class="status-indicator">⚪</span> <span>Idle</span>';

      if (status.last_heal) {
        const lastTime = new Date(status.last_heal);
        const ageSeconds = Math.round((Date.now() - lastTime) / 1000);
        if (ageSeconds < 60) {
          ageEl.textContent = `Last run: ${ageSeconds}s ago`;
        } else if (ageSeconds < 3600) {
          ageEl.textContent = `Last run: ${Math.round(ageSeconds / 60)}m ago`;
        } else {
          ageEl.textContent = `Last run: ${Math.round(ageSeconds / 3600)}h ago`;
        }
      } else {
        ageEl.textContent = 'No healing runs yet';
      }

      if (flowIndicator) {
        flowIndicator.setAttribute('data-flow-status', 'idle');
        flowIndicator.innerHTML = '<span class="status-dot">⚪</span> <span>Waiting for errors...</span>';
      }

      if (flowStats) flowStats.innerHTML = '<span>No active healing</span>';
      if (flowPatterns) flowPatterns.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating healing status:', error);
  }
}

// ============================================================================
// KNOWLEDGE BASE UPDATE
// ============================================================================
async function updateKnowledgeBase() {
  try {
    const data = await API.getSuccessPatternsStats();

    if (!data || data.error) {
      console.warn('Knowledge base data unavailable');
      return;
    }

    const stats = data.stats || {};
    const topPatterns = data.top_patterns || [];
    const recentPatterns = data.recent_patterns || [];
    const byFamily = data.by_family || [];

    // Update stats cards
    const totalEl = document.querySelector('[data-kb-total]');
    const goldEl = document.querySelector('[data-kb-gold]');
    const avgConfEl = document.querySelector('[data-kb-avg-confidence]');
    const successesEl = document.querySelector('[data-kb-successes]');

    if (totalEl) totalEl.textContent = stats.total_patterns || '0';
    if (goldEl) goldEl.textContent = stats.gold_standard || '0';
    if (avgConfEl) {
      const avgConf = stats.avg_confidence || 0;
      avgConfEl.textContent = `${(avgConf * 100).toFixed(1)}%`;
    }
    if (successesEl) successesEl.textContent = stats.total_successes || '0';

    // Update pattern count in overview widget
    const patternCountEl = document.querySelector('[data-metric="pattern-count"]');
    if (patternCountEl) patternCountEl.textContent = stats.total_patterns || '--';

    // Update top patterns
    const topPatternsEl = document.getElementById('top-patterns');
    if (topPatternsEl) {
      if (topPatterns.length === 0) {
        topPatternsEl.innerHTML = '<p class="hint">No patterns recorded yet</p>';
      } else {
        topPatternsEl.innerHTML = topPatterns.map(p => {
          const isGold = p.tags && p.tags.includes('GOLD_STANDARD');
          const badgeClass = isGold ? 'pattern-badge gold' : 'pattern-badge';
          return `
            <div class="pattern-card">
              <div class="pattern-header">
                <span class="pattern-code">${p.error_code}</span>
                <span class="${badgeClass}">${p.success_count}× ${isGold ? '⭐' : ''}</span>
              </div>
              <div class="pattern-description">${p.fix_description}</div>
              <div class="pattern-stats">
                <span class="pattern-stat">📊 ${(p.avg_confidence * 100).toFixed(1)}% confidence</span>
                <span class="pattern-stat">🏷️ ${p.tags || 'none'}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Update recent patterns
    const recentPatternsEl = document.getElementById('recent-patterns');
    if (recentPatternsEl) {
      if (recentPatterns.length === 0) {
        recentPatternsEl.innerHTML = '<p class="hint">No recent patterns (last 24h)</p>';
      } else {
        recentPatternsEl.innerHTML = recentPatterns.map(p => {
          const lastSuccess = new Date(p.last_success);
          const timeAgo = formatTimeAgo(lastSuccess);
          return `
            <div class="pattern-card">
              <div class="pattern-header">
                <span class="pattern-code">${p.error_code}</span>
                <span class="pattern-badge">${p.success_count}×</span>
              </div>
              <div class="pattern-description">${p.fix_description}</div>
              <div class="pattern-stats">
                <span class="pattern-stat">🕒 ${timeAgo}</span>
                <span class="pattern-stat">📊 ${(p.avg_confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Update patterns by family
    const familyListEl = document.getElementById('patterns-by-family');
    if (familyListEl) {
      if (byFamily.length === 0) {
        familyListEl.innerHTML = '<p class="hint">No error families recorded</p>';
      } else {
        familyListEl.innerHTML = byFamily.map(f => `
          <div class="family-item">
            <span class="family-name">${f.family}</span>
            <span class="family-stats">
              <span>📦 ${f.pattern_count} patterns</span>
              <span>✅ ${f.total_successes} successes</span>
            </span>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Error updating knowledge base:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================================
// AUTO-REFRESH SETUP
// ============================================================================
let healingStatusInterval = null;
let knowledgeBaseInterval = null;

function startAutoRefresh() {
  // Update healing status every 2 seconds (active healing detection)
  if (!healingStatusInterval) {
    healingStatusInterval = setInterval(() => {
      updateHealingStatus().catch(err => console.error('Auto-refresh healing status failed:', err));
    }, 2000);
  }

  // Update knowledge base every 10 seconds (less frequent, larger data)
  if (!knowledgeBaseInterval) {
    knowledgeBaseInterval = setInterval(() => {
      updateKnowledgeBase().catch(err => console.error('Auto-refresh knowledge base failed:', err));
    }, 10000);
  }

  console.log('Auto-refresh started: Healing (2s), Knowledge Base (10s)');
}

function stopAutoRefresh() {
  if (healingStatusInterval) {
    clearInterval(healingStatusInterval);
    healingStatusInterval = null;
  }
  if (knowledgeBaseInterval) {
    clearInterval(knowledgeBaseInterval);
    knowledgeBaseInterval = null;
  }
  console.log('Auto-refresh stopped');
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing dashboard enhancements...');

  // Initial load
  updateHealingStatus();
  updateKnowledgeBase();

  // Start auto-refresh
  startAutoRefresh();

  // Stop auto-refresh when page is hidden (battery/performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
    }
  });

  console.log('Dashboard enhancements initialized ✓');
});

// Export for manual calls
window.DashboardEnhancements = {
  updateHealingStatus,
  updateKnowledgeBase,
  startAutoRefresh,
  stopAutoRefresh
};
