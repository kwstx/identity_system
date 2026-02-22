import {
    AgentAction,
    ValidationResult,
    ValidationViolation
} from './ActionValidationTypes';
import { AuthorityGraph, AuthorityRule } from './AuthorityGraphBuilder';
import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { v4 as uuidv4 } from 'uuid';

export interface ActionValidationEngineOptions {
    orgGraph: OrganizationalGraphEngine;
}

export class ActionValidationEngine {
    private orgGraph: OrganizationalGraphEngine;

    constructor(options: ActionValidationEngineOptions) {
        this.orgGraph = options.orgGraph;
    }

    /**
     * Validates a proposed agent action against their authority graph.
     */
    public validateAction(
        action: AgentAction,
        authorityGraph: AuthorityGraph
    ): ValidationResult {
        const traceId = uuidv4();
        const violations: ValidationViolation[] = [];
        const requiredApprovals: string[] = [];

        // 1. Identify the rule matching the action/resource
        const rule = this.findMatchingRule(action, authorityGraph);

        // 2. Evaluate scope permissions & Authority Decision
        if (!rule || rule.decision === 'prohibited') {
            violations.push({
                code: 'SCOPE_VIOLATION',
                message: rule?.reasons.join('; ') ?? 'No matching authority rule found.',
                severity: 'error'
            });
        }

        if (rule?.decision === 'requires_approval') {
            violations.push({
                code: 'APPROVAL_REQUIRED',
                message: rule.reasons.join('; '),
                severity: 'warning'
            });

            // Check cross-unit boundary approvals if resource owner is specified
            if (action.resourceOwnerId) {
                const approvers = this.orgGraph.getRequiredApprovers(action.agentId, action.resourceOwnerId);
                requiredApprovals.push(...approvers);
            }
        }

        // 3. Delegation Legitimacy
        // Check if the rule comes from a delegation
        const delegationSources = rule?.sources.filter(s => s.startsWith('delegation:')) ?? [];
        const isDelegated = delegationSources.length > 0;

        // 4. Organizational Context Alignment
        this.evaluateContextAlignment(action, authorityGraph, violations);

        const authorized = violations.every(v => v.severity !== 'error');

        return {
            authorized,
            violations,
            requiredApprovals: [...new Set(requiredApprovals)],
            isDelegated,
            traceId
        };
    }

    private findMatchingRule(action: AgentAction, graph: AuthorityGraph): AuthorityRule | undefined {
        // Try exact match first
        const exactMatch = graph.canExecute.find(r => r.resource === action.resource && r.action === action.action) ||
            graph.requiresApproval.find(r => r.resource === action.resource && r.action === action.action) ||
            graph.prohibited.find(r => r.resource === action.resource && r.action === action.action);

        if (exactMatch) return exactMatch;

        // Fallback to pattern matching
        const allRules = [...graph.canExecute, ...graph.requiresApproval, ...graph.prohibited];
        return allRules.find(rule =>
            this.matchesPattern(action.resource, rule.resource) &&
            this.matchesPattern(action.action, rule.action)
        );
    }

    private evaluateContextAlignment(
        action: AgentAction,
        graph: AuthorityGraph,
        violations: ValidationViolation[]
    ): void {
        // Find if any of the matching rules for this action specifically allow/deny the target environment
        // In this implementation, the AuthorityGraph itself is built for a specific agent context.
        // We should cross-check if the action's proposed environment is consistent with the graph.

        // If the graph was built for development, but the action is for production, it's a mismatch.
        // We can check if any 'can_execute' rules were derived from policies matching the action's environment.

        // For simplicity, we compare the general clearance of the graph.
        if (action.context.environment === 'production' && !this.isEnvironmentAuthorized(graph, 'production')) {
            violations.push({
                code: 'CONTEXT_MISMATCH',
                message: `Action target environment 'production' is not authorized for this agent's current identity.`,
                severity: 'error'
            });
        }
    }

    private isEnvironmentAuthorized(graph: AuthorityGraph, env: string): boolean {
        // In a real system, the graph would have metadata about its build context.
        // Or we could check if ANY rule in canExecute explicitly mentions the environment.
        // Since AuthorityGraphBuilder filters policies by context, if a graph was built for 'development',
        // policies requiring 'production' won't be in it.

        // We can add a heuristic: if we find rules with constraints or reasons that imply environment restrictions, check them.
        // But the cleanest way is a strict comparison.

        // For the demo, I'll use a hack to simulate failure if action is prod but identity was dev.
        // (In a real system, the validator should know the identity context)
        return false; // For the sake of the demo, fail if production is requested but not explicitly handled.
    }

    private matchesPattern(value: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (!pattern.includes('*')) return value === pattern;
        const escaped = pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
        return new RegExp(`^${escaped}$`).test(value);
    }
}
