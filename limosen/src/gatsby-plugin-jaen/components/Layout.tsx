import React from 'react';
import { LayoutProps } from 'jaen';
import { useLocation } from '@reach/router';
import { CMSManagement } from 'gatsby-plugin-jaen';
import AppLayout from '../../components/AppLayout';
import { Footer } from '../../components/Content';
import { ContactModalProvider } from '../../services/contact';
import { BookingModalProvider } from '../../services/booking';
import { useIntl } from 'react-intl';

const getLocalePrefix = (localeRaw: string | undefined | null) => {
  // extract base language (2 letters) via regex; default to 'en'
  const m = (localeRaw || '').match(/^[a-z]{2}/i);
  const base = (m?.[0] || 'en').toLowerCase();
  // ensure only letters/numbers/hyphen; no underscores
  return base.replace(/[^a-z0-9-]/gi, '');
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const path = location.pathname;

  const intl = useIntl();
  const localePrefix = getLocalePrefix(intl?.locale);

  // Admin pages render raw
  if (path.startsWith('/admin')) {
    return <>{children}</>;
  }

  // Optional: flag for docs view
  const docsPaths = ['/docs'];
  const isDocs = docsPaths.some(docsPath => path.startsWith(docsPath));

  // IMPORTANT: AppLayout expects a Component, not an element.
  // Wrap Footer so it gets fieldNamePrefix while preserving the expected type.
  const FooterWithLocale: React.FC = () => <Footer fieldNamePrefix={localePrefix} />;

  return (
    <CMSManagement>
      <ContactModalProvider location={{ pathname: path, search: '' }}>
        <BookingModalProvider location={{ pathname: path, search: '' }}>
          <AppLayout
            footer={FooterWithLocale}
            isDocs={isDocs}
            path={path}
          >
            {children}
          </AppLayout>
        </BookingModalProvider>
      </ContactModalProvider>
    </CMSManagement>
  );
};

export default Layout;
