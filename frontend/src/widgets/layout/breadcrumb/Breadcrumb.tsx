/**
 * Breadcrumb applicazione con griglia dxc-webkit (Box, Row, Col) e Breadcrumb.
 */
import { Box, Row, Col, Breadcrumb as DxcBreadcrumb, BreadcrumbItem, BreadcrumbIcon, icons } from 'dxc-webkit'
import { APP_NAME } from '@/app/config/constants'

const HOME_HREF = '/'

export function Breadcrumb() {
  return (
    <Box style={{ paddingLeft: '1.5rem' }}>
      <Row>
        <Col xs="12">
          <DxcBreadcrumb activeKey="app" aria-label="Navigazione">
            <BreadcrumbItem key="home" href={HOME_HREF} aria-label="Home">
              <BreadcrumbIcon Icon={icons.HomeIcon} />
            </BreadcrumbItem>
            <BreadcrumbItem key="app" href={HOME_HREF}>
              {APP_NAME}
            </BreadcrumbItem>
          </DxcBreadcrumb>
        </Col>
      </Row>
    </Box>
  )
}
