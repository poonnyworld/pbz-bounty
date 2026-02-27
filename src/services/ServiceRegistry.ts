import { BountyService } from './BountyService';

/**
 * Service registry for event handlers to access BountyService.
 */
class ServiceRegistry {
  private bountyService: BountyService | null = null;

  public setBountyService(service: BountyService): void {
    this.bountyService = service;
  }

  public getBountyService(): BountyService | null {
    return this.bountyService;
  }
}

export const serviceRegistry = new ServiceRegistry();
